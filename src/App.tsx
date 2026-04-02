import React, { useState, useEffect, useRef, useMemo, ChangeEvent, Component } from 'react';
import { MapPin, Copy, Check, Navigation, RefreshCw, User, Phone, Home, Send, Map as MapIcon, AlertTriangle, CheckCircle2, ArrowRight, Shield, Clock, Leaf, Menu, X, ChevronRight, Star, Instagram, Facebook, Twitter, Briefcase, Truck, Calendar, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GoogleGenAI } from "@google/genai";
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, getDocFromServer } from 'firebase/firestore';

// Error Handling Types
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

class ErrorBoundary extends Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let message = "Une erreur est survenue.";
      try {
        const errObj = JSON.parse(this.state.error.message);
        if (errObj.error && errObj.error.includes("insufficient permissions")) {
          message = "Erreur de permissions Firestore. Veuillez contacter l'administrateur.";
        }
      } catch (e) {
        // Not a JSON error
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
          <div className="bg-white p-10 rounded-[40px] shadow-2xl max-w-md text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h2 className="text-2xl font-black mb-4">Oups !</h2>
            <p className="text-gray-600 mb-8">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px]"
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Fix for default marker icon in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconRetinaUrl: iconRetina,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Types
interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

// Components
function MapRecenter({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (zoom) {
      map.setView([lat, lng], zoom);
    } else {
      map.setView([lat, lng]);
    }
  }, [lat, lng, zoom, map]);
  return null;
}

function LocationPicker({ location, setLocation }: { location: LocationData | null, setLocation: (loc: LocationData) => void }) {
  useMapEvents({
    click(e) {
      setLocation({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
        accuracy: 0,
        timestamp: Date.now()
      });
    }
  });

  const markerRef = useRef<L.Marker>(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const pos = marker.getLatLng();
          setLocation({
            latitude: pos.lat,
            longitude: pos.lng,
            accuracy: 0,
            timestamp: Date.now()
          });
        }
      },
    }),
    [setLocation]
  );

  return location ? (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={[location.latitude, location.longitude]}
      ref={markerRef}
    >
      <Popup>
        Votre position exacte <br /> 
        {location.accuracy > 0 ? `Précision: ±${location.accuracy.toFixed(0)}m` : 'Position manuelle'}
        <br />
        <span className="text-xs text-gray-500">(Déplacez le marqueur si besoin)</span>
      </Popup>
    </Marker>
  ) : null;
}

const LandingPage = ({ onSubscribe, onPartner, onRecruit, onAdmin }: { onSubscribe: () => void, onPartner: () => void, onRecruit: () => void, onAdmin: () => void }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [images, setImages] = useState<{ [key: string]: string }>({});
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    // Listen to images in Firestore
    const unsub = onSnapshot(doc(db, 'settings', 'images'), (docSnap) => {
      if (docSnap.exists()) {
        setImages(docSnap.data() as { [key: string]: string });
        setIsGenerating(false);
      } else {
        // If no images in Firestore, try to load from localStorage or generate
        loadInitialImages();
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/images');
    });

    const loadInitialImages = async () => {
      const storedImages = localStorage.getItem('lipidus_images');
      if (storedImages) {
        const parsed = JSON.parse(storedImages);
        setImages(parsed);
        setIsGenerating(false);
        // Sync to Firestore if not already there (optional, but good for migration)
        return;
      }

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const model = "gemini-2.5-flash-image";

        const prompts = {
          collector: "A professional waste collector, a Black Ivorian man, wearing a green work uniform with 'LIPIDUS' clearly written on the chest. He is working in a modern residential courtyard in Abidjan, Côte d'Ivoire. High quality, realistic photography.",
          commercials: "A group of smiling young Black Ivorian men and women, wearing clean white t-shirts with 'LIPIDUS' written on them. They look professional and friendly, standing in a sunny street in Abidjan. High quality, realistic photography.",
          partner: "A Black Ivorian man sitting on a green motorized tricycle (moto-tricycle) designed for waste collection. The back of the tricycle is filled with neatly packed trash bags. He is on a street in Abidjan. High quality, realistic photography."
        };

        const generatedImages: { [key: string]: string } = {};

        for (const [key, prompt] of Object.entries(prompts)) {
          const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [{ text: prompt }] },
          });

          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              generatedImages[key] = `data:image/png;base64,${part.inlineData.data}`;
              break;
            }
          }
        }
        setImages(generatedImages);
        // We don't save to localStorage anymore, we'll let the admin save to Firestore
      } catch (error) {
        console.error("Error generating images:", error);
      } finally {
        setIsGenerating(false);
      }
    };

    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 overflow-x-hidden font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-2xl border-b border-gray-100/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex justify-between items-center h-20 lg:h-24">
            <div className="flex items-center gap-3">
              <span className="text-2xl lg:text-3xl font-black tracking-tighter text-emerald-600 font-display">LIPIDUS</span>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-12">
              <a href="#offres" className="text-[10px] font-black text-gray-400 hover:text-emerald-600 transition-all uppercase tracking-[0.3em]">Nos Offres</a>
              <div 
                onClick={onRecruit}
                className="cursor-pointer text-[10px] font-black text-gray-400 hover:text-amber-600 transition-all uppercase tracking-[0.3em]"
              >
                Recrutement
              </div>
              <a href="#contact" className="text-[10px] font-black text-gray-400 hover:text-emerald-600 transition-all uppercase tracking-[0.3em]">Contact</a>
              <div 
                onClick={onPartner}
                className="cursor-pointer text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] hover:text-indigo-600 transition-all"
              >
                Devenir Partenaire
              </div>
              <div 
                onClick={onSubscribe}
                className="cursor-pointer text-emerald-600 text-[10px] font-black uppercase tracking-[0.3em] border-b-2 border-emerald-600 pb-1 hover:text-emerald-700 hover:border-emerald-700 transition-all"
              >
                S'abonner
              </div>
            </div>

            {/* Mobile Menu Toggle */}
            <div className="md:hidden">
              <div onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 cursor-pointer">
                {isMenuOpen ? <X className="w-8 h-8 text-gray-900" /> : <Menu className="w-8 h-8 text-gray-900" />}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden bg-white border-b border-gray-100 overflow-hidden"
            >
              <div className="px-6 py-10 space-y-8">
                <a href="#offres" onClick={() => setIsMenuOpen(false)} className="block text-2xl font-black text-gray-900 uppercase tracking-tighter">Nos Offres</a>
                <div 
                  onClick={() => { setIsMenuOpen(false); onRecruit(); }}
                  className="text-gray-900 text-2xl font-black uppercase tracking-tighter hover:text-amber-600 transition-colors cursor-pointer"
                >
                  Recrutement
                </div>
                <a href="#contact" onClick={() => setIsMenuOpen(false)} className="block text-2xl font-black text-gray-900 uppercase tracking-tighter">Contact</a>
                <div 
                  onClick={() => { setIsMenuOpen(false); onPartner(); }}
                  className="text-gray-900 text-2xl font-black uppercase tracking-tighter hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  Devenir Partenaire
                </div>
                <div 
                  onClick={() => { setIsMenuOpen(false); onSubscribe(); }}
                  className="text-emerald-600 text-2xl font-black uppercase tracking-tighter border-b-4 border-emerald-600 inline-block"
                >
                  S'abonner
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-12 gap-16 lg:gap-24 items-center">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-7"
            >
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-[0.3em] mb-10">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Abidjan, Côte d'Ivoire
              </div>
              <h1 className="text-6xl md:text-7xl lg:text-[110px] font-black leading-[0.85] mb-12 tracking-[-0.05em] text-gray-900 font-display">
                Gardez les mains <span className="text-emerald-600">propre</span>, on se sali pour <span className="text-emerald-600">vous</span>.
              </h1>
              <p className="text-lg lg:text-xl text-gray-500 mb-16 max-w-xl leading-relaxed font-medium">
                LIPIDUS redéfinit la propreté urbaine à Abidjan. Un service de collecte de proximité, fiable et engagé pour un environnement sain.
              </p>
              <div 
                onClick={onSubscribe}
                className="inline-flex items-center gap-6 cursor-pointer group"
              >
                <span className="text-xl lg:text-2xl font-black uppercase tracking-tighter text-emerald-600 border-b-4 border-emerald-600 pb-1 group-hover:text-emerald-700 group-hover:border-emerald-700 transition-all font-display">
                  Rejoindre l'aventure
                </span>
                <div className="w-12 h-12 rounded-full border-2 border-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <ArrowRight className="w-6 h-6" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-5 relative"
            >
              <div className="aspect-[4/5] rounded-[40px] lg:rounded-[80px] overflow-hidden bg-gray-100 shadow-2xl">
                {images.collector ? (
                  <img 
                    src={images.collector} 
                    alt="Collecteur LIPIDUS" 
                    className="w-full h-full object-cover scale-110 hover:scale-100 transition-transform duration-1000"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 font-black uppercase tracking-widest text-[10px]">
                    {isGenerating ? "Génération..." : "LIPIDUS"}
                  </div>
                )}
              </div>
              <motion.div 
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="absolute -bottom-8 -left-8 lg:-bottom-12 lg:-left-12 bg-white p-8 lg:p-12 rounded-[30px] lg:rounded-[50px] shadow-2xl border border-gray-50 hidden md:block"
              >
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 lg:w-20 lg:h-20 bg-emerald-600 rounded-2xl lg:rounded-3xl flex items-center justify-center">
                    <Shield className="w-6 h-6 lg:w-10 lg:h-10 text-white" />
                  </div>
                  <div>
                    <p className="text-xl lg:text-3xl font-black tracking-tighter font-display">100% Garanti</p>
                    <p className="text-gray-400 font-black text-[10px] uppercase tracking-[0.2em]">Service Premium</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Offers Section */}
      <section id="offres" className="py-32 lg:py-48 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="mb-24 lg:mb-32">
            <h2 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.5em] mb-8">Nos Formules</h2>
            <p className="text-5xl md:text-7xl lg:text-[100px] font-black tracking-[-0.05em] leading-[0.85] font-display">Choisissez votre <br /> niveau de confort.</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                title: "Hebdomadaire",
                price: "1 500f",
                period: "/ semaine",
                desc: "Idéal pour tester notre efficacité.",
                features: ["Ramassage 2x par semaine", "Sac poubelle offert", "Désinfection des bacs"]
              },
              {
                title: "Mensuel",
                price: "5 000f",
                period: "/ mois",
                desc: "La tranquillité d'esprit au quotidien.",
                features: ["Ramassage 2x par semaine", "Sac poubelle offert", "Désinfection des bacs"],
                popular: true
              },
              {
                title: "LIPIDUS Pro",
                price: "+400 000f",
                period: "/ mois",
                desc: "Devenez partenaire avec votre moto-tricycle.",
                features: ["Partenariat logistique", "Revenus garantis", "Support technique"],
                pro: true
              }
            ].map((offer, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.8 }}
                whileHover={{ y: -15 }}
                className={`p-10 lg:p-14 rounded-[40px] lg:rounded-[60px] border-2 flex flex-col ${offer.pro ? 'border-indigo-600 bg-indigo-50/20' : offer.popular ? 'border-emerald-600 bg-emerald-50/20' : 'border-gray-100 bg-gray-50/20'} transition-all`}
              >
                <div className="mb-10">
                  <h3 className="text-2xl lg:text-3xl font-black uppercase tracking-tighter mb-3 font-display">{offer.title}</h3>
                  <p className="text-gray-500 font-bold text-sm leading-relaxed">{offer.desc}</p>
                </div>
                <div className="mb-12">
                  <span className="text-5xl lg:text-6xl font-black tracking-tighter font-display">{offer.price}</span>
                  <span className="text-gray-400 font-black ml-2 uppercase text-[10px] tracking-widest">{offer.period}</span>
                </div>
                <ul className="space-y-6 mb-16 flex-grow">
                  {offer.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-4 text-sm font-black text-gray-600">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${offer.pro ? 'bg-indigo-100' : 'bg-emerald-100'}`}>
                        <CheckCircle2 className={`w-3 h-3 ${offer.pro ? 'text-indigo-600' : 'text-emerald-600'}`} />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <div 
                  onClick={offer.pro ? onPartner : onSubscribe}
                  className={`cursor-pointer text-center py-6 lg:py-8 rounded-[25px] lg:rounded-[35px] font-black uppercase tracking-[0.2em] text-[10px] transition-all ${offer.pro ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700' : offer.popular ? 'bg-emerald-600 text-white shadow-2xl shadow-emerald-600/30 hover:bg-emerald-700' : 'bg-gray-900 text-white hover:bg-black'}`}
                >
                  {offer.pro ? "Devenir Partenaire" : "S'abonner"}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Recruitment Section */}
      <section id="recrutement" className="py-32 lg:py-48 bg-gray-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-24 lg:gap-32 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="order-2 lg:order-1"
            >
              <div className="aspect-square rounded-[40px] lg:rounded-[80px] overflow-hidden bg-gray-800 shadow-2xl group">
                {images.commercials ? (
                  <img 
                    src={images.commercials} 
                    alt="Équipe Commerciale" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 font-black uppercase tracking-widest text-[10px]">
                    {isGenerating ? "Génération..." : "TEAM"}
                  </div>
                )}
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="order-1 lg:order-2"
            >
              <h2 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.5em] mb-10">Recrutement</h2>
              <h3 className="text-5xl md:text-7xl lg:text-[90px] font-black tracking-[-0.05em] leading-[0.85] mb-12 font-display">Rejoignez la <br /> force de vente.</h3>
              <p className="text-lg lg:text-xl text-gray-400 mb-16 leading-relaxed font-medium">
                Nous recrutons des commerciaux terrain dynamiques pour porter la vision de LIPIDUS dans chaque quartier d'Abidjan.
              </p>
              <div className="bg-gray-800/50 p-10 lg:p-14 rounded-[40px] lg:rounded-[60px] border border-gray-700/50 backdrop-blur-sm">
                <p className="text-emerald-500 font-black text-4xl lg:text-6xl tracking-tighter mb-4 font-display">150 000f / mois</p>
                <p className="text-gray-500 font-black uppercase tracking-[0.2em] text-[10px]">Rémunération attractive selon performance</p>
              </div>
              <div className="mt-16">
                <div 
                  onClick={onRecruit}
                  className="inline-flex items-center gap-6 cursor-pointer group"
                >
                  <span className="text-xl lg:text-2xl font-black uppercase tracking-tighter text-emerald-500 border-b-4 border-emerald-500 pb-1 group-hover:text-emerald-400 group-hover:border-emerald-400 transition-all font-display">
                    Postuler maintenant
                  </span>
                  <div className="w-12 h-12 rounded-full border-2 border-emerald-500 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all">
                    <ArrowRight className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Partner Section */}
      <section className="py-32 lg:py-48 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-24 lg:gap-32 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
            >
              <h2 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.5em] mb-10">LIPIDUS Pro</h2>
              <h3 className="text-5xl md:text-7xl lg:text-[90px] font-black tracking-[-0.05em] leading-[0.85] mb-12 font-display">Rentabilisez votre <br /> moto-tricycle.</h3>
              <p className="text-lg lg:text-xl text-gray-500 mb-16 leading-relaxed font-medium">
                Vous possédez un tricycle ? Devenez un acteur clé de la salubrité à Abidjan et générez des revenus stables et importants.
              </p>
              <div className="bg-emerald-50/50 p-10 lg:p-14 rounded-[40px] lg:rounded-[60px] border border-emerald-100/50 backdrop-blur-sm">
                <p className="text-emerald-600 font-black text-4xl lg:text-6xl tracking-tighter mb-4 font-display">+400 000f / mois</p>
                <p className="text-emerald-800/40 font-black uppercase tracking-[0.2em] text-[10px]">Potentiel de gain pour nos partenaires Pro</p>
              </div>
              <div className="mt-16">
                <div 
                  onClick={onPartner}
                  className="inline-flex items-center gap-6 cursor-pointer group"
                >
                  <span className="text-xl lg:text-2xl font-black uppercase tracking-tighter text-emerald-600 border-b-4 border-emerald-600 pb-1 group-hover:text-emerald-700 group-hover:border-emerald-700 transition-all font-display">
                    Devenir Partenaire Pro
                  </span>
                  <div className="w-12 h-12 rounded-full border-2 border-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <ArrowRight className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="relative"
            >
              <div className="aspect-square rounded-[40px] lg:rounded-[80px] overflow-hidden bg-gray-100 shadow-2xl group">
                {images.partner ? (
                  <img 
                    src={images.partner} 
                    alt="Partenaire LIPIDUS Pro" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 font-black uppercase tracking-widest text-[10px]">
                    {isGenerating ? "Génération..." : "PRO"}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gray-900 text-white pt-32 lg:pt-48 pb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-12 gap-24 mb-32">
            <div className="lg:col-span-6">
              <div className="flex items-center gap-3 mb-12">
                <span className="text-4xl lg:text-5xl font-black tracking-tighter font-display">LIPIDUS</span>
              </div>
              <p className="text-gray-400 text-xl lg:text-2xl max-w-md mb-16 leading-relaxed font-medium">
                Leader de la collecte de proximité à Abidjan. Gardez les mains propre, on se sali pour vous.
              </p>
              <div className="flex gap-8">
                {[Facebook, Twitter, Instagram].map((Icon, i) => (
                  <div key={i} className="w-16 h-16 rounded-3xl bg-gray-800/50 flex items-center justify-center hover:bg-emerald-600 transition-all cursor-pointer group">
                    <Icon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="lg:col-span-6 grid grid-cols-2 gap-12 lg:gap-24">
              <div>
                <h4 className="font-black mb-12 text-[10px] uppercase tracking-[0.4em] text-emerald-500">Navigation</h4>
                <ul className="space-y-8 text-gray-400 font-black text-sm uppercase tracking-widest">
                  <li><a href="#" className="hover:text-white transition-colors">Accueil</a></li>
                  <li><a href="#offres" className="hover:text-white transition-colors">Offres</a></li>
                  <li><a href="#recrutement" className="hover:text-white transition-colors">Recrutement</a></li>
                  <li><div onClick={onSubscribe} className="hover:text-white transition-colors cursor-pointer">S'abonner</div></li>
                </ul>
              </div>

              <div>
                <h4 className="font-black mb-12 text-[10px] uppercase tracking-[0.4em] text-emerald-500">Contact</h4>
                <ul className="space-y-8 text-gray-400 font-black text-sm uppercase tracking-widest">
                  <li className="flex items-center gap-4"><Phone className="w-5 h-5 text-emerald-500" /> +225 05 66 78 30 88</li>
                  <li className="flex items-center gap-4"><MapIcon className="w-5 h-5 text-emerald-500" /> Abidjan, CI</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="pt-16 border-t border-gray-800/50 text-center text-gray-600 text-[10px] font-black uppercase tracking-[0.6em]">
            <p onClick={onAdmin} className="cursor-pointer hover:text-gray-400 transition-colors inline-block">© {new Date().getFullYear()} LIPIDUS. TOUS DROITS RÉSERVÉS.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const RegistrationForm = ({ onBack }: { onBack: () => void }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    commune: '',
    neighborhood: '',
  });
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      const onlyNums = value.replace(/[^0-9]/g, '');
      if (onlyNums.length <= 15) {
        setFormData((prev) => ({ ...prev, [name]: onlyNums }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const getPosition = () => {
    setLoading(true);
    setError(null);
    setLocation(null);
    setSuccessMsg(null);

    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas supportée par votre navigateur.");
      setLoading(false);
      return;
    }

    let bestLocation: LocationData | null = null;
    let watchId: number;
    let timeoutId: ReturnType<typeof setTimeout>;

    const stopWatching = () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timeoutId);
      setLoading(false);
      if (!bestLocation) {
        setError("Impossible d'obtenir la position. Veuillez vérifier vos paramètres de localisation.");
      } else {
        if (bestLocation.accuracy > 15) {
          setSuccessMsg(`Position trouvée (précision: ±${Math.round(bestLocation.accuracy)}m). Veuillez ajuster manuellement le marqueur sur votre toit exact.`);
        } else {
          setSuccessMsg("Position chirurgicale obtenue avec succès !");
        }
        setTimeout(() => setSuccessMsg(null), 6000);
      }
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };

        if (!bestLocation || newLocation.accuracy < bestLocation.accuracy) {
          bestLocation = newLocation;
          setLocation(newLocation);
          
          if (newLocation.accuracy <= 3) {
            stopWatching();
          }
        }
      },
      (err) => {
        if (!bestLocation) {
          let message = "Une erreur est survenue lors de la récupération de la position.";
          if (err.code === 1) message = "Permission refusée. Veuillez autoriser l'accès à la position pour LIPIDUS.";
          if (err.code === 2) message = "Position non disponible.";
          if (err.code === 3) message = "Délai d'attente dépassé.";
          setError(message);
          stopWatching();
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );

    timeoutId = setTimeout(() => {
      stopWatching();
    }, 20000);
  };

  const generateMessageText = () => {
    return `📋 *NOUVELLE INSCRIPTION LIPIDUS* 🗑️
👤 *Client :* ${formData.fullName || 'Non renseigné'}
📞 *Téléphone :* ${formData.phone || 'Non renseigné'}
🏙️ *Commune :* ${formData.commune || 'Non renseigné'}
📍 *Quartier/Repère :* ${formData.neighborhood || 'Non renseigné'}

🗺️ *Coordonnées GPS :*
Latitude: ${location?.latitude.toFixed(6)}
Longitude: ${location?.longitude.toFixed(6)}
🔗 *Lien Google Maps :*
https://www.google.com/maps?q=${location?.latitude},${location?.longitude}`;
  };

  const copyToClipboard = () => {
    if (!location) return;
    const text = generateMessageText();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const sendToWhatsApp = () => {
    if (!location) return;
    const text = generateMessageText();
    const encodedText = encodeURIComponent(text);
    const WHATSAPP_NUMBER = '2250566783088'; 
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`, '_blank');
  };

  const isFormFilled = formData.fullName.trim() !== '' && formData.phone.length >= 8 && formData.commune.trim() !== '';
  const isFormValid = isFormFilled && location !== null;

  const getMissingInfo = () => {
    const missing = [];
    if (formData.fullName.trim() === '') missing.push("votre nom");
    if (formData.phone.length < 8) missing.push("un numéro de téléphone valide");
    if (formData.commune.trim() === '') missing.push("votre commune");
    if (!location) missing.push("votre position GPS (bouton vert)");
    return missing;
  };

  const missingInfo = getMissingInfo();

  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 font-sans flex flex-col items-center justify-center p-0 md:p-8 lg:p-12 selection:bg-emerald-100 selection:text-emerald-900">
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full min-h-screen md:min-h-0 md:max-w-2xl bg-white md:rounded-[40px] lg:rounded-[60px] shadow-2xl shadow-emerald-900/5 border border-gray-100 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-emerald-50/50 p-10 lg:p-16 pb-12 relative overflow-hidden border-b border-emerald-100/50">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-100/30 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div 
            onClick={onBack}
            className="absolute top-10 left-10 lg:top-16 lg:left-16 p-3 bg-white rounded-2xl shadow-sm hover:bg-emerald-50 hover:text-emerald-600 transition-all z-20 cursor-pointer group"
          >
            <ArrowRight className="w-6 h-6 rotate-180 group-hover:-translate-x-1 transition-transform" />
          </div>
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-600/20">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-4 text-gray-900 font-display">LIPIDUS <span className="text-emerald-600">CLIENT</span></h1>
            <p className="text-emerald-800/40 font-black uppercase tracking-[0.3em] text-[10px]">Abonnement Service de Collecte</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-8 lg:p-16 space-y-12">
          
          {/* Form Section */}
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">01</span>
                Vos Informations
              </h2>
              {isFormFilled && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 lg:gap-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom et Prénom <span className="text-emerald-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-300 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-emerald-600/20 transition-all outline-none placeholder:text-gray-300"
                    placeholder="Ex: Jean Dupont"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Téléphone <span className="text-emerald-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-300 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    maxLength={15}
                    className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-emerald-600/20 transition-all outline-none placeholder:text-gray-300"
                    placeholder="Ex: 0566783088"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Commune <span className="text-emerald-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <MapIcon className="h-5 w-5 text-gray-300 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    name="commune"
                    value={formData.commune}
                    onChange={handleInputChange}
                    className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-emerald-600/20 transition-all outline-none placeholder:text-gray-300"
                    placeholder="Ex: Cocody"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Quartier ou repère</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Home className="h-5 w-5 text-gray-300 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    name="neighborhood"
                    value={formData.neighborhood}
                    onChange={handleInputChange}
                    className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-emerald-600/20 transition-all outline-none placeholder:text-gray-300"
                    placeholder="Ex: Près de la pharmacie..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Location Section */}
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">02</span>
                Position GPS
              </h2>
              {location && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
            </div>

            {!location && (
              <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-[30px] p-6 flex gap-4 items-start backdrop-blur-sm">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed font-bold">
                  Étape obligatoire. Cliquez sur la carte pour indiquer votre position ou utilisez le bouton de localisation automatique.
                </p>
              </div>
            )}

            {error && (
              <div className="p-5 bg-red-50 border border-red-100 rounded-[25px] text-red-600 text-[10px] font-black uppercase tracking-widest text-center">
                {error}
              </div>
            )}

            <AnimatePresence>
              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-[25px] text-emerald-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 justify-center mb-4">
                    <CheckCircle2 className="w-4 h-4" />
                    {successMsg}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div 
              onClick={(e) => { 
                e.preventDefault(); 
                if (isFormFilled) getPosition(); 
              }}
              className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all active:scale-95 cursor-pointer ${
                !isFormFilled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : location 
                    ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xl shadow-emerald-600/30'
              }`}
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Navigation className="w-5 h-5" />
              )}
              {loading ? 'Recherche...' : location ? 'Mettre à jour ma position' : 'Trouver ma position'}
            </div>

            <div className="h-[400px] lg:h-[500px] w-full rounded-[40px] lg:rounded-[60px] overflow-hidden border-4 border-gray-50 relative z-0 shadow-2xl">
              <MapContainer 
                center={location ? [location.latitude, location.longitude] : [5.359951, -4.008256]} 
                zoom={location ? 19 : 12} 
                scrollWheelZoom={true} 
                className="h-full w-full z-0"
                attributionControl={false}
              >
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                />
                <LocationPicker location={location} setLocation={setLocation as any} />
                {location && <MapRecenter lat={location.latitude} lng={location.longitude} zoom={19} />}
                {location && location.accuracy > 0 && location.accuracy < 500 && (
                  <Circle 
                    center={[location.latitude, location.longitude]} 
                    radius={location.accuracy} 
                    pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2, weight: 1 }} 
                  />
                )}
              </MapContainer>
            </div>
            
            {location && (
               <motion.div 
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="bg-gray-900 p-8 rounded-[35px] lg:rounded-[50px] shadow-2xl"
               >
                 <p className="text-xs text-gray-400 leading-relaxed flex items-start gap-4">
                   <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center shrink-0">
                     <AlertTriangle className="w-5 h-5 text-white" />
                   </div>
                   <span className="font-bold">
                     <strong className="text-emerald-500 uppercase tracking-widest block mb-2">Précision Chirurgicale :</strong> 
                     Zoomez au maximum et déplacez le marqueur pour le placer <span className="text-white">exactement sur votre toit</span>. Notre équipe se basera uniquement sur ce point précis.
                   </span>
                 </p>
               </motion.div>
            )}
          </div>

          {/* Action Section */}
          <div className="space-y-6 pt-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] flex items-center gap-3 mb-8">
              <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">03</span>
              Validation
            </h2>

            <div
              onClick={isFormValid ? sendToWhatsApp : undefined}
              className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all cursor-pointer ${
                isFormValid 
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-2xl shadow-emerald-600/30' 
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
              Envoyer via WhatsApp
            </div>

            <div
              onClick={isFormValid ? copyToClipboard : undefined}
              className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all cursor-pointer ${
                isFormValid 
                  ? 'bg-white border-2 border-gray-100 text-gray-900 hover:bg-gray-50 active:scale-95' 
                  : 'bg-transparent border-2 border-gray-50 text-gray-200 cursor-not-allowed'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 text-emerald-500" />
                  Copié !
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copier les infos
                </>
              )}
            </div>
            
            {!isFormValid && (
              <div className="mt-8 p-8 bg-red-50/50 rounded-[30px] border border-red-100/50">
                <p className="text-[10px] text-red-600 font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Informations manquantes :
                </p>
                <ul className="space-y-2">
                  {missingInfo.map((info, i) => (
                    <li key={i} className="text-xs text-red-800/60 font-bold flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-red-400" />
                      {info}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const PartnerForm = ({ onBack }: { onBack: () => void }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    commune: '',
    equipmentType: 'Moto-tricycle',
    experience: '',
  });

  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getPosition = () => {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setLoading(false);
        setSuccessMsg("Position GPS récupérée avec succès !");
      },
      (err) => {
        setLoading(false);
        setError("Impossible de récupérer votre position. Veuillez l'indiquer manuellement sur la carte.");
        console.error(err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const getMissingInfo = () => {
    const missing = [];
    if (!formData.fullName) missing.push("Nom complet");
    if (!formData.phone) missing.push("Numéro de téléphone");
    if (!formData.commune) missing.push("Commune");
    if (!location) missing.push("Position GPS");
    return missing;
  };

  const isFormFilled = formData.fullName && formData.phone && formData.commune;
  const isFormValid = isFormFilled && location;

  const generateMessage = () => {
    const mapsLink = location ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}` : 'Non spécifiée';
    return `*NOUVELLE CANDIDATURE PARTENAIRE LIPIDUS PRO*%0A%0A` +
           `*Nom:* ${formData.fullName}%0A` +
           `*Tél:* ${formData.phone}%0A` +
           `*Commune:* ${formData.commune}%0A` +
           `*Équipement:* ${formData.equipmentType}%0A` +
           `*Expérience:* ${formData.experience || 'Non précisée'}%0A%0A` +
           `*Position GPS:* ${mapsLink}`;
  };

  const sendToWhatsApp = () => {
    const message = generateMessage();
    window.open(`https://wa.me/2250566783088?text=${message}`, '_blank');
  };

  const copyToClipboard = () => {
    const mapsLink = location ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}` : 'Non spécifiée';
    const text = `CANDIDATURE PARTENAIRE LIPIDUS PRO\n\n` +
                 `Nom: ${formData.fullName}\nTél: ${formData.phone}\nCommune: ${formData.commune}\n` +
                 `Équipement: ${formData.equipmentType}\nExpérience: ${formData.experience || 'Non précisée'}\n\n` +
                 `Position GPS: ${mapsLink}`;
    
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const missingInfo = getMissingInfo();

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 font-sans flex flex-col items-center justify-center p-0 md:p-8 lg:p-12 selection:bg-indigo-100 selection:text-indigo-900">
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full min-h-screen md:min-h-0 md:max-w-2xl bg-white md:rounded-[40px] lg:rounded-[60px] shadow-2xl shadow-indigo-900/5 border border-gray-100 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gray-900 p-10 lg:p-16 pb-12 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#4f46e5,transparent_70%)]" />
          </div>
          <div 
            onClick={onBack}
            className="absolute top-10 left-10 lg:top-16 lg:left-16 p-3 bg-white/10 backdrop-blur-md rounded-2xl hover:bg-white/20 text-white transition-all z-20 cursor-pointer group"
          >
            <ArrowRight className="w-6 h-6 rotate-180 group-hover:-translate-x-1 transition-transform" />
          </div>
          <div className="relative z-10 flex flex-col items-center text-center">
            <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-4 text-white font-display">LIPIDUS <span className="text-indigo-400">PRO</span></h1>
            <p className="text-indigo-200/60 font-black uppercase tracking-[0.3em] text-[10px]">Portail Partenaires & Logistique</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-8 lg:p-16 space-y-12">
          
          {/* Form Section */}
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">01</span>
                Profil Partenaire
              </h2>
              {isFormFilled && <CheckCircle2 className="w-6 h-6 text-indigo-500" />}
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 lg:gap-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom Complet <span className="text-indigo-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-indigo-600/20 transition-all outline-none placeholder:text-gray-300"
                    placeholder="Ex: Kouassi Koffi"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Téléphone <span className="text-indigo-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-indigo-600/20 transition-all outline-none placeholder:text-gray-300"
                    placeholder="Ex: 0707..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Commune <span className="text-indigo-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <MapIcon className="h-5 w-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    name="commune"
                    value={formData.commune}
                    onChange={handleInputChange}
                    className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-indigo-600/20 transition-all outline-none placeholder:text-gray-300"
                    placeholder="Ex: Yopougon"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Type d'équipement <span className="text-indigo-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Truck className="h-5 w-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <select
                    name="equipmentType"
                    value={formData.equipmentType}
                    onChange={handleInputChange}
                    className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-indigo-600/20 transition-all outline-none appearance-none cursor-pointer"
                  >
                    <option value="Moto-tricycle">Moto-tricycle</option>
                    <option value="Camion">Camion</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Expérience (optionnel)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Briefcase className="h-5 w-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="text"
                  name="experience"
                  value={formData.experience}
                  onChange={handleInputChange}
                  className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-indigo-600/20 transition-all outline-none placeholder:text-gray-300"
                  placeholder="Ex: 2 ans dans la collecte..."
                />
              </div>
            </div>
          </div>

          {/* Location Section */}
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">02</span>
                Zone d'activité
              </h2>
              {location && <CheckCircle2 className="w-6 h-6 text-indigo-500" />}
            </div>

            {!location && (
              <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-[30px] p-6 flex gap-4 items-start backdrop-blur-sm">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                </div>
                <p className="text-xs text-indigo-800 leading-relaxed font-bold">
                  Indiquez votre zone de résidence ou de stationnement habituelle pour optimiser les tournées.
                </p>
              </div>
            )}

            {error && (
              <div className="p-5 bg-red-50 border border-red-100 rounded-[25px] text-red-600 text-[10px] font-black uppercase tracking-widest text-center">
                {error}
              </div>
            )}

            <div 
              onClick={(e) => { 
                e.preventDefault(); 
                if (isFormFilled) getPosition(); 
              }}
              className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all active:scale-95 cursor-pointer ${
                !isFormFilled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : location 
                    ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-200 hover:bg-indigo-100'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xl shadow-indigo-600/30'
              }`}
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Navigation className="w-5 h-5" />
              )}
              {loading ? 'Recherche...' : location ? 'Mettre à jour ma position' : 'Trouver ma position'}
            </div>

            <div className="h-[400px] lg:h-[500px] w-full rounded-[40px] lg:rounded-[60px] overflow-hidden border-4 border-gray-50 relative z-0 shadow-2xl">
              <MapContainer 
                center={location ? [location.latitude, location.longitude] : [5.359951, -4.008256]} 
                zoom={location ? 19 : 12} 
                scrollWheelZoom={true} 
                className="h-full w-full z-0"
                attributionControl={false}
              >
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                />
                <LocationPicker location={location} setLocation={setLocation as any} />
                {location && <MapRecenter lat={location.latitude} lng={location.longitude} zoom={19} />}
              </MapContainer>
            </div>
          </div>

          {/* Action Section */}
          <div className="space-y-6 pt-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] flex items-center gap-3 mb-8">
              <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">03</span>
              Validation
            </h2>

            <div
              onClick={isFormValid ? sendToWhatsApp : undefined}
              className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all cursor-pointer ${
                isFormValid 
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-2xl shadow-indigo-600/30' 
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
              Envoyer ma candidature
            </div>

            <div
              onClick={isFormValid ? copyToClipboard : undefined}
              className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all cursor-pointer ${
                isFormValid 
                  ? 'bg-white border-2 border-gray-100 text-gray-900 hover:bg-gray-50 active:scale-95' 
                  : 'bg-transparent border-2 border-gray-50 text-gray-200 cursor-not-allowed'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 text-indigo-500" />
                  Copié !
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copier les infos
                </>
              )}
            </div>
            
            {!isFormValid && (
              <div className="mt-8 p-8 bg-red-50/50 rounded-[30px] border border-red-100/50">
                <p className="text-[10px] text-red-600 font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Informations manquantes :
                </p>
                <ul className="space-y-2">
                  {missingInfo.map((info, i) => (
                    <li key={i} className="text-xs text-red-800/60 font-bold flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-red-400" />
                      {info}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const RecruitmentForm = ({ onBack }: { onBack: () => void }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    commune: '',
    age: '',
    experience: '',
    motivation: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isFormFilled = formData.fullName && formData.phone && formData.commune && formData.age;

  const generateMessage = () => {
    return `*NOUVELLE CANDIDATURE FORCE DE VENTE LIPIDUS*%0A%0A` +
           `*Nom:* ${formData.fullName}%0A` +
           `*Tél:* ${formData.phone}%0A` +
           `*Âge:* ${formData.age} ans%0A` +
           `*Commune:* ${formData.commune}%0A` +
           `*Expérience:* ${formData.experience || 'Non précisée'}%0A` +
           `*Motivation:* ${formData.motivation || 'Non précisée'}`;
  };

  const sendToWhatsApp = () => {
    const message = generateMessage();
    window.open(`https://wa.me/2250566783088?text=${message}`, '_blank');
  };

  const copyToClipboard = () => {
    const text = `CANDIDATURE FORCE DE VENTE LIPIDUS\n\n` +
                 `Nom: ${formData.fullName}\nTél: ${formData.phone}\nÂge: ${formData.age}\nCommune: ${formData.commune}\n` +
                 `Expérience: ${formData.experience || 'Non précisée'}\nMotivation: ${formData.motivation || 'Non précisée'}`;
    
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getMissingInfo = () => {
    const missing = [];
    if (!formData.fullName) missing.push("Nom complet");
    if (!formData.phone) missing.push("Numéro de téléphone");
    if (!formData.age) missing.push("Âge");
    if (!formData.commune) missing.push("Commune");
    return missing;
  };

  const missingInfo = getMissingInfo();

  return (
    <div className="min-h-screen bg-amber-50/30 text-gray-900 font-sans flex flex-col items-center justify-center p-0 md:p-8 lg:p-12 selection:bg-amber-100 selection:text-amber-900">
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full min-h-screen md:min-h-0 md:max-w-2xl bg-white md:rounded-[40px] lg:rounded-[60px] shadow-2xl shadow-amber-900/5 border border-gray-100 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-amber-500 p-10 lg:p-16 pb-12 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#ffffff,transparent_70%)]" />
          </div>
          <div 
            onClick={onBack}
            className="absolute top-10 left-10 lg:top-16 lg:left-16 p-3 bg-white/20 backdrop-blur-md rounded-2xl hover:bg-white/30 text-white transition-all z-20 cursor-pointer group"
          >
            <ArrowRight className="w-6 h-6 rotate-180 group-hover:-translate-x-1 transition-transform" />
          </div>
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-xl">
              <Star className="w-6 h-6 text-amber-500" />
            </div>
            <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-4 text-white font-display">LIPIDUS <span className="text-amber-200">TALENT</span></h1>
            <p className="text-amber-100/60 font-black uppercase tracking-[0.3em] text-[10px]">Rejoindre la Force de Vente</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-8 lg:p-16 space-y-12">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">01</span>
                Informations Candidat
              </h2>
              {isFormFilled && <CheckCircle2 className="w-6 h-6 text-amber-500" />}
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 lg:gap-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom Complet <span className="text-amber-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-300 group-focus-within:text-amber-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-amber-600/20 transition-all outline-none placeholder:text-gray-300"
                    placeholder="Ex: Kouassi Koffi"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Téléphone <span className="text-amber-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-300 group-focus-within:text-amber-500 transition-colors" />
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-amber-600/20 transition-all outline-none placeholder:text-gray-300"
                    placeholder="Ex: 0707..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Âge <span className="text-amber-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-300 group-focus-within:text-amber-500 transition-colors" />
                  </div>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-amber-600/20 transition-all outline-none placeholder:text-gray-300"
                    placeholder="Ex: 25"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Commune <span className="text-amber-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <MapIcon className="h-5 w-5 text-gray-300 group-focus-within:text-amber-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    name="commune"
                    value={formData.commune}
                    onChange={handleInputChange}
                    className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-amber-600/20 transition-all outline-none placeholder:text-gray-300"
                    placeholder="Ex: Cocody"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Expérience en vente</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Briefcase className="h-5 w-5 text-gray-300 group-focus-within:text-amber-500 transition-colors" />
                </div>
                <input
                  type="text"
                  name="experience"
                  value={formData.experience}
                  onChange={handleInputChange}
                  className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-amber-600/20 transition-all outline-none placeholder:text-gray-300"
                  placeholder="Ex: 1 an chez..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Motivation</label>
              <textarea
                name="motivation"
                value={formData.motivation}
                onChange={handleInputChange as any}
                rows={4}
                className="block w-full px-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-amber-600/20 transition-all outline-none placeholder:text-gray-300 resize-none"
                placeholder="Pourquoi voulez-vous rejoindre LIPIDUS ?"
              />
            </div>
          </div>

          {/* Action Section */}
          <div className="space-y-6 pt-8">
            <div
              onClick={isFormFilled ? sendToWhatsApp : undefined}
              className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all cursor-pointer ${
                isFormFilled 
                  ? 'bg-amber-500 text-white hover:bg-amber-600 active:scale-95 shadow-2xl shadow-amber-600/30' 
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
              Postuler via WhatsApp
            </div>

            <div
              onClick={isFormFilled ? copyToClipboard : undefined}
              className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all cursor-pointer ${
                isFormFilled 
                  ? 'bg-white border-2 border-gray-100 text-gray-900 hover:bg-gray-50 active:scale-95' 
                  : 'bg-transparent border-2 border-gray-50 text-gray-200 cursor-not-allowed'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 text-amber-500" />
                  Copié !
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copier les infos
                </>
              )}
            </div>
            
            {!isFormFilled && (
              <div className="mt-8 p-8 bg-amber-50/50 rounded-[30px] border border-amber-100/50">
                <p className="text-[10px] text-amber-600 font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Informations manquantes :
                </p>
                <ul className="space-y-2">
                  {missingInfo.map((info, i) => (
                    <li key={i} className="text-xs text-amber-800/60 font-bold flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-amber-400" />
                      {info}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const AdminPage = ({ onBack }: { onBack: () => void }) => {
  const [password, setPassword] = useState('');
  const [isPasswordCorrect, setIsPasswordCorrect] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [images, setImages] = useState<{ [key: string]: string }>({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Listen to images in Firestore
    const unsub = onSnapshot(doc(db, 'settings', 'images'), (docSnap) => {
      if (docSnap.exists()) {
        setImages(docSnap.data() as { [key: string]: string });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/images');
    });

    // Listen to auth state
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    return () => {
      unsub();
      unsubAuth();
    };
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Reine2001') {
      setIsPasswordCorrect(true);
      setError('');
    } else {
      setError('Code d\'accès incorrect');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError("Erreur de connexion Google: " + err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleImageUpload = async (key: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) { // Firestore limit is 1MB, let's stay safe
        setError("L'image est trop volumineuse (max 800KB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const newImages = { ...images, [key]: base64 };
        setImages(newImages);
        
        if (user && user.email === "jorisahoussi4@gmail.com") {
          setIsSaving(true);
          try {
            await setDoc(doc(db, 'settings', 'images'), newImages);
            setError('');
          } catch (err: any) {
            handleFirestoreError(err, OperationType.WRITE, 'settings/images');
          } finally {
            setIsSaving(false);
          }
        } else {
          setError("Vous devez être connecté avec le compte administrateur pour enregistrer.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isPasswordCorrect) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="bg-white p-10 rounded-[40px] max-w-md w-full shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div onClick={onBack} className="cursor-pointer p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowRight className="w-6 h-6 rotate-180" />
            </div>
            <h2 className="text-2xl font-black font-display">Accès Restreint</h2>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Code d'accès</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-2 p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 transition-all outline-none"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
            <button type="submit" className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-black transition-colors">
              Valider
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div onClick={onBack} className="cursor-pointer p-3 bg-white shadow-sm hover:shadow-md rounded-2xl transition-all">
              <ArrowRight className="w-6 h-6 rotate-180" />
            </div>
            <div>
              <h1 className="text-3xl font-black font-display">Administration</h1>
              <p className="text-gray-500 text-sm font-bold">Gestion des images de la page d'accueil</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4 bg-white p-2 pr-6 rounded-full shadow-sm border border-gray-100">
                <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Connecté en tant que</p>
                  <p className="text-xs font-bold text-gray-900">{user.email}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="ml-4 text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors"
                >
                  Déconnexion
                </button>
              </div>
            ) : (
              <button 
                onClick={handleGoogleLogin}
                className="flex items-center gap-3 px-6 py-3 bg-white border-2 border-gray-100 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                Connexion Google
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-8 p-6 bg-red-50 border border-red-100 rounded-3xl text-red-600 text-sm font-bold flex items-center gap-4">
            <AlertTriangle className="w-6 h-6" />
            {error}
          </div>
        )}

        {isSaving && (
          <div className="mb-8 p-6 bg-emerald-50 border border-emerald-100 rounded-3xl text-emerald-600 text-sm font-bold flex items-center gap-4 animate-pulse">
            <RefreshCw className="w-6 h-6 animate-spin" />
            Enregistrement dans la base de données...
          </div>
        )}

        <div className="grid gap-8">
          {[
            { key: 'collector', title: 'Image Collecteur (Section Héros)', desc: 'Image principale en haut de la page' },
            { key: 'commercials', title: 'Image Commerciaux (Section Recrutement)', desc: 'Image de la force de vente' },
            { key: 'partner', title: 'Image Partenaire (Section Pro)', desc: 'Image du tricycle logistique' }
          ].map((zone) => (
            <div key={zone.key} className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8 items-center">
              <div className="w-full md:w-1/3 aspect-square bg-gray-100 rounded-3xl overflow-hidden relative">
                {images[zone.key] ? (
                  <img src={images[zone.key]} alt={zone.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold">Aucune image</div>
                )}
              </div>
              <div className="flex-1 space-y-4">
                <h3 className="text-xl font-black font-display">{zone.title}</h3>
                <p className="text-gray-500 text-sm">{zone.desc}</p>
                <div className="pt-4">
                  <label className="cursor-pointer inline-flex items-center gap-3 px-6 py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-100 transition-colors">
                    <Upload className="w-4 h-4" />
                    Modifier l'image
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => handleImageUpload(zone.key, e)}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<'home' | 'register' | 'partner' | 'recruit' | 'admin'>('home');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  return (
    <ErrorBoundary>
      <AnimatePresence mode="wait">
        {view === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <LandingPage 
              onSubscribe={() => setView('register')} 
              onPartner={() => setView('partner')}
              onRecruit={() => setView('recruit')}
              onAdmin={() => setView('admin')}
            />
          </motion.div>
        )}
        {view === 'register' && (
          <motion.div
            key="register"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3, type: 'spring', damping: 25, stiffness: 120 }}
          >
            <RegistrationForm onBack={() => setView('home')} />
          </motion.div>
        )}
        {view === 'partner' && (
          <motion.div
            key="partner"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3, type: 'spring', damping: 25, stiffness: 120 }}
          >
            <PartnerForm onBack={() => setView('home')} />
          </motion.div>
        )}
        {view === 'recruit' && (
          <motion.div
            key="recruit"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3, type: 'spring', damping: 25, stiffness: 120 }}
          >
            <RecruitmentForm onBack={() => setView('home')} />
          </motion.div>
        )}
        {view === 'admin' && (
          <motion.div
            key="admin"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.3 }}
          >
            <AdminPage onBack={() => setView('home')} />
          </motion.div>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
}
