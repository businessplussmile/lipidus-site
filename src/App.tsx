import React, { useState, useEffect, useRef, useMemo, ChangeEvent, Component } from 'react';
import { MapPin, Copy, Check, Navigation, RefreshCw, User, Phone, Home, Send, Map as MapIcon, AlertTriangle, CheckCircle2, ArrowRight, Shield, Clock, Leaf, ChevronRight, Star, Instagram, Facebook, Twitter, Briefcase, Truck, Calendar, Upload } from 'lucide-react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GoogleGenAI } from "@google/genai";
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, getDocFromServer, collection } from 'firebase/firestore';

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
  state = {
    hasError: false,
    error: null
  };

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

    return (this as any).props.children;
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

const LipiCompanion = ({ sectionRefs }: { sectionRefs: { hero: any, offres: any, recrutement: any, partner: any, footer: any } }) => {
  const [state, setState] = useState<'hello' | 'walking' | 'jumping' | 'resting' | 'goodbye'>('hello');
  const [isHovered, setIsHovered] = useState(false);
  const [recruitPhase, setRecruitPhase] = useState(0);
  const [recruitMsgIndex, setRecruitMsgIndex] = useState(0);
  const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  
  const isHeroInView = useInView(sectionRefs.hero, { amount: 0.3 });
  const isOffresInView = useInView(sectionRefs.offres, { amount: 0.3 });
  const isRecrutementInView = useInView(sectionRefs.recrutement, { amount: 0.3 });
  const isPartnerInView = useInView(sectionRefs.partner, { amount: 0.3 });
  const isFooterInView = useInView(sectionRefs.footer, { amount: 0.3 });

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let t1: any, t2: any, t3: any;
    if (isRecrutementInView) {
      setRecruitPhase(1);
      t1 = setTimeout(() => setRecruitPhase(2), 4000);
      t2 = setTimeout(() => setRecruitPhase(3), 6000);
      t3 = setTimeout(() => setRecruitPhase(4), 9000);
    } else {
      setRecruitPhase(0);
      setRecruitMsgIndex(0);
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isRecrutementInView]);

  useEffect(() => {
    if (recruitPhase === 4) {
      const interval = setInterval(() => {
        setRecruitMsgIndex(prev => (prev + 1) % 4);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [recruitPhase]);

  useEffect(() => {
    if (isFooterInView) setState('goodbye');
    else if (isPartnerInView) setState('resting');
    else if (isRecrutementInView) setState('jumping');
    else if (isOffresInView) setState('walking');
    else if (isHeroInView) setState('hello');
  }, [isHeroInView, isOffresInView, isRecrutementInView, isPartnerInView, isFooterInView]);

  const getExpression = () => {
    if (isHovered) return 'surprised';
    if (state === 'hello') return 'happy';
    if (state === 'resting') return 'chill';
    if (state === 'jumping') return 'excited';
    return 'default';
  };

  const expression = getExpression();
  const isRiding = state === 'resting';
  const isMokoWalking = recruitPhase === 1 || recruitPhase === 3;

  const recruitMessages = [
    "Regardez cette équipe ! 🤩",
    "On recrute des commerciaux terrain.",
    "150 000f/mois + primes ! 💰",
    "On y va ? 🚀"
  ];

  const FriendMascot = ({ color, delay }: { color: string, delay: number }) => (
    <motion.div
      initial={{ x: 50, opacity: 0 }}
      animate={{ 
        x: 0, 
        opacity: 1,
        y: isMokoWalking ? [0, -8, 0] : 0,
        rotate: isMokoWalking ? [-5, 5, -5] : 0
      }}
      transition={{ duration: 0.8, repeat: isMokoWalking ? Infinity : 0, delay }}
      className="relative w-12 h-16 md:w-14 md:h-18 flex flex-col items-center justify-center overflow-hidden rounded-t-[20px] rounded-b-[10px] border-2 border-white/20 shadow-xl"
      style={{ backgroundColor: color }}
    >
      <div className="absolute top-1 left-2 w-3 h-1.5 bg-white/20 rounded-full blur-[1px] rotate-[-15deg]" />
      <div className="flex gap-2 mb-1">
        <div className="w-2 h-2 bg-black rounded-full relative">
          <div className="absolute top-0.5 left-0.5 w-0.5 h-0.5 bg-white rounded-full" />
        </div>
        <div className="w-2 h-2 bg-black rounded-full relative">
          <div className="absolute top-0.5 left-0.5 w-0.5 h-0.5 bg-white rounded-full" />
        </div>
      </div>
      <div className="w-4 h-1 bg-black/10 rounded-full" />
    </motion.div>
  );

  return (
    <motion.div
      initial={{ y: 200, opacity: 0 }}
      animate={{ 
        y: state === 'goodbye' && !isHovered ? 200 : 0, 
        opacity: state === 'goodbye' && !isHovered ? 0 : 1,
        x: isOffresInView ? -100 : 
           recruitPhase === 1 ? -screenWidth + 150 : 
           recruitPhase === 2 ? -screenWidth - 200 :
           recruitPhase >= 3 ? -screenWidth + 400 : 0,
      }}
      transition={{ 
        duration: recruitPhase === 1 || recruitPhase === 2 || recruitPhase === 3 ? 4 : 0.6,
        type: recruitPhase === 0 ? 'spring' : 'tween',
        damping: 20, 
        stiffness: 100 
      }}
      className="fixed bottom-8 right-8 z-[90] pointer-events-auto"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        animate={{
          scale: isHovered ? 1.1 : 1,
          rotate: isHovered ? [0, -5, 5, 0] : 0,
        }}
        className="relative w-16 h-20 md:w-20 md:h-24 cursor-pointer flex flex-col items-center"
      >
        {/* Friends (Recruitment Sequence) */}
        <AnimatePresence>
          {recruitPhase >= 3 && (
            <div className="absolute -left-32 top-4 flex gap-4 z-0">
              <FriendMascot color="#34d399" delay={0} />
              <FriendMascot color="#6ee7b7" delay={0.1} />
            </div>
          )}
        </AnimatePresence>
        {/* Moto-Tricycle - Back Layer (Wheels, Seat, Exhaust) */}
        <AnimatePresence>
          {isRiding && (
            <motion.div
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1, y: [0, -1, 0] }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ 
                x: { type: 'spring', damping: 20 },
                y: { repeat: Infinity, duration: 0.1 }
              }}
              className="absolute bottom-0 w-32 h-24 z-0 -left-6"
            >
              {/* Wheels */}
              <div className="absolute bottom-0 left-4 w-10 h-10 bg-gray-900 rounded-full border-4 border-gray-700 flex items-center justify-center shadow-lg">
                <div className="w-6 h-6 border-2 border-dashed border-gray-600 rounded-full animate-[spin_1s_linear_infinity]" />
              </div>
              <div className="absolute bottom-0 right-4 w-10 h-10 bg-gray-900 rounded-full border-4 border-gray-700 flex items-center justify-center shadow-lg">
                <div className="w-6 h-6 border-2 border-dashed border-gray-600 rounded-full animate-[spin_1s_linear_infinity]" />
              </div>
              {/* Seat */}
              <div className="absolute top-8 left-8 w-14 h-4 bg-gray-800 rounded-t-xl border-b-2 border-gray-900 shadow-inner" />
              {/* Exhaust Pipe */}
              <div className="absolute bottom-4 left-[-8px] w-10 h-3 bg-gray-400 rounded-full border-b-2 border-gray-600 rotate-[5deg]">
                <div className="absolute right-0 w-2 h-2 bg-gray-900 rounded-full" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Arms - Positioned to hold handlebars */}
        <div className="absolute inset-0 flex justify-between items-center px-[-10px] z-25 pointer-events-none">
          <motion.div 
            animate={{ 
              rotate: state === 'hello' ? [0, -40, 0] : isRiding ? -30 : 0,
              y: state === 'jumping' ? -10 : isRiding ? 5 : 0,
              x: isRiding ? 10 : 0
            }}
            transition={{ repeat: state === 'hello' ? Infinity : 0, duration: 0.5 }}
            className="w-6 h-2 bg-emerald-400 rounded-full origin-right border border-white/10" 
          />
          <motion.div 
            animate={{ 
              rotate: isRiding ? 30 : 0,
              y: state === 'jumping' ? -10 : isRiding ? 5 : 0,
              x: isRiding ? -5 : 0
            }}
            className="w-6 h-2 bg-emerald-400 rounded-full origin-left border border-white/10" 
          />
        </div>

        {/* Mascot Body */}
        <motion.div
          animate={{
            y: isRiding ? -5 : 
               isMokoWalking ? [0, -8, 0] : 
               state === 'jumping' ? [0, -20, 0] : 
               state === 'walking' ? [0, -4, 0] : 
               0,
            rotate: isMokoWalking ? [-5, 5, -5] : 0,
            scaleY: isRiding ? 0.85 : [1, 0.98, 1.02, 1],
          }}
          transition={{
            duration: isMokoWalking ? 0.8 : state === 'jumping' ? 0.6 : 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative w-full h-full bg-emerald-500 rounded-t-[30px] rounded-b-[15px] shadow-2xl shadow-emerald-500/20 flex flex-col items-center justify-center overflow-hidden border-4 border-white/10 z-10"
        >
          <div className="absolute top-2 left-3 w-4 h-2 bg-white/20 rounded-full blur-[1px] rotate-[-15deg]" />

          {/* Eyes */}
          <div className="flex gap-3 mb-1">
            <div className="w-2.5 h-2.5 bg-black rounded-full relative">
              <div className="absolute top-0.5 left-0.5 w-1 h-1 bg-white rounded-full" />
            </div>
            <div className="w-2.5 h-2.5 bg-black rounded-full relative">
              <div className="absolute top-0.5 left-0.5 w-1 h-1 bg-white rounded-full" />
            </div>
          </div>

          {/* Mouth */}
          <motion.div 
            animate={{ 
              width: expression === 'surprised' ? 14 : expression === 'happy' ? 18 : 8,
              height: expression === 'surprised' ? 14 : expression === 'happy' ? 6 : 2,
              borderRadius: expression === 'happy' ? "0 0 15px 15px" : "15px"
            }}
            className="bg-black/20" 
          />
        </motion.div>

        {/* Moto-Tricycle - Front Layer (Body, Headlight, Handlebar) */}
        <AnimatePresence>
          {isRiding && (
            <motion.div
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1, y: [0, -1, 0] }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ 
                x: { type: 'spring', damping: 20 },
                y: { repeat: Infinity, duration: 0.1 }
              }}
              className="absolute bottom-0 w-32 h-24 z-30 -left-6 pointer-events-none"
            >
              {/* Main Body */}
              <div className="absolute bottom-2 left-0 w-full h-12 bg-gradient-to-b from-amber-300 to-amber-500 rounded-[20px] border-2 border-amber-600 shadow-xl overflow-hidden">
                <div className="absolute top-1 left-4 w-16 h-2 bg-white/30 rounded-full blur-[1px]" />
                <div className="absolute bottom-2 right-8 flex gap-1">
                  <div className="w-1 h-4 bg-amber-700/30 rounded-full" />
                  <div className="w-1 h-4 bg-amber-700/30 rounded-full" />
                </div>
              </div>
              {/* Front Fork & Handlebar */}
              <div className="absolute top-2 right-4 w-4 h-16 bg-gray-400 rounded-full rotate-[-20deg] border-r-2 border-gray-500 shadow-sm" />
              <div className="absolute top-0 right-0 w-10 h-4 bg-gray-900 rounded-full border-2 border-gray-700 shadow-md flex items-center justify-between px-1">
                <div className="w-2 h-2 bg-gray-600 rounded-full" />
                <div className="w-2 h-2 bg-gray-600 rounded-full" />
              </div>
              {/* Headlight */}
              <div className="absolute top-6 right-1 w-6 h-6 bg-white rounded-full border-2 border-amber-200 shadow-[0_0_15px_rgba(255,255,255,0.8)] flex items-center justify-center overflow-hidden">
                <div className="w-full h-full bg-gradient-to-tr from-amber-100 to-white" />
              </div>
              {/* Windshield */}
              <div className="absolute top-[-10px] right-6 w-8 h-10 bg-sky-200/40 backdrop-blur-sm rounded-t-full border border-white/30 rotate-[-10deg]" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legs */}
        {!isRiding && (
          <div className="flex gap-4 mt-[-5px] z-0">
            <motion.div 
              animate={{ 
                y: state === 'walking' ? [0, -5, 0] : 0,
                rotate: state === 'walking' ? [0, 15, 0] : 0
              }}
              transition={{ repeat: Infinity, duration: 0.4 }}
              className="w-3 h-5 bg-emerald-600 rounded-full border border-white/10" 
            />
            <motion.div 
              animate={{ 
                y: state === 'walking' ? [-5, 0, -5] : 0,
                rotate: state === 'walking' ? [0, -15, 0] : 0
              }}
              transition={{ repeat: Infinity, duration: 0.4 }}
              className="w-3 h-5 bg-emerald-600 rounded-full border border-white/10" 
            />
          </div>
        )}

        {/* Shadow */}
        {!isRiding && (
          <motion.div
            animate={{
              scale: state === 'jumping' ? [1, 0.6, 1] : [1, 0.9, 1],
              opacity: state === 'jumping' ? [0.2, 0.1, 0.2] : [0.2, 0.15, 0.2],
            }}
            transition={{ duration: state === 'jumping' ? 0.6 : 1.5, repeat: Infinity }}
            className="w-12 h-2 bg-black rounded-full blur-md mt-2"
          />
        )}

        {/* Speech Bubble */}
        <AnimatePresence>
          {(isHovered || isOffresInView || isRiding || recruitPhase === 4) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: -70 }}
              exit={{ opacity: 0, scale: 0.5, y: 10 }}
              className="absolute left-1/2 -translate-x-1/2 bg-white px-5 py-2 rounded-2xl shadow-2xl border border-gray-100 whitespace-nowrap z-50"
            >
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">
                {recruitPhase === 4 ? recruitMessages[recruitMsgIndex] : 
                 isRiding ? "En route pour le partenariat ! 🛵" : 
                 isOffresInView ? "On s'abonne ? 🚀" : 
                 "Lipidus à votre service !"}
              </p>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-r border-b border-gray-100" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

const LandingPage = ({ onSubscribe, onPartner, onRecruit, onAdmin, sectionRefs }: { onSubscribe: (offer?: string) => void, onPartner: () => void, onRecruit: () => void, onAdmin: () => void, sectionRefs: any }) => {
  const [images, setImages] = useState<{ [key: string]: string }>({});
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    // Listen to images in Firestore (using individual documents to avoid 1MB limit)
    const unsub = onSnapshot(collection(db, 'settings'), (snapshot) => {
      const newImages: { [key: string]: string } = {};
      snapshot.forEach(docSnap => {
        if (docSnap.id.startsWith('img_')) {
          const key = docSnap.id.replace('img_', '');
          newImages[key] = docSnap.data().url;
        }
      });

      if (Object.keys(newImages).length > 0) {
        setImages(prev => ({ ...prev, ...newImages }));
        setIsGenerating(false);
      } else {
        // If no images in Firestore, try to load from localStorage or generate
        loadInitialImages();
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings');
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
    <div className="min-h-screen bg-[#f9f9f7] text-gray-900 overflow-x-hidden font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Minimalist Hero Section (Navbar Replacement) */}
      <section ref={sectionRefs.hero} className="h-screen w-full flex flex-col items-center justify-between py-16 lg:py-24 relative overflow-hidden">
        {/* Top Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="px-6 py-2 border border-black/5 rounded-full"
        >
          <span className="text-[10px] font-black uppercase tracking-[0.5em] text-black">
            Abidjan, Côte d'Ivoire
          </span>
        </motion.div>

        {/* Main Title */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="flex flex-col items-center"
        >
          <h1 className="text-[16vw] font-black leading-none tracking-[-0.08em] text-black uppercase font-display">
            Lipidus
          </h1>
        </motion.div>

        {/* Info Line */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col md:flex-row items-center gap-12 lg:gap-16"
        >
          <div className="text-[10px] font-black text-gray-300 uppercase tracking-[0.4em]">
            Lipidus votre service clé en main
          </div>
          
          <div className="hidden md:block w-[1px] h-12 bg-black/5" />
          
          <div className="flex items-center gap-8 group cursor-default">
            <div className="flex -space-x-5">
              {[1, 2, 3].map((i) => (
                <motion.div 
                  key={i} 
                  whileHover={{ y: -5, scale: 1.05, zIndex: 10 }}
                  className="w-14 h-14 rounded-full border-[6px] border-[#f9f9f7] overflow-hidden bg-white shadow-xl shadow-black/5 relative transition-all duration-300"
                >
                  <img 
                    src={images[`hero_avatar_${i}`] || `https://i.pravatar.cc/150?u=lipidus_${i}`} 
                    alt="Avis client satisfait du service de collecte de déchets LIPIDUS" 
                    className="w-full h-full object-cover transition-all duration-500 opacity-90 hover:opacity-100"
                    referrerPolicy="no-referrer"
                  />
                </motion.div>
              ))}
              <motion.div 
                whileHover={{ y: -5, scale: 1.05, zIndex: 10 }}
                className="w-14 h-14 rounded-full border-[6px] border-[#f9f9f7] bg-amber-400 flex items-center justify-center shadow-xl shadow-amber-400/20 relative z-0"
              >
                <span className="text-[10px] font-black text-white">+</span>
              </motion.div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-black leading-none tracking-tighter">2,500+</span>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              </div>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1.5">Clients satisfaits</span>
            </div>
          </div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="flex flex-col items-center"
        >
          <div className="w-6 h-10 border-2 border-black/5 rounded-full flex justify-center p-1.5">
            <motion.div
              animate={{ y: [0, 14, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-1 h-1 bg-amber-400 rounded-full"
            />
          </div>
        </motion.div>
      </section>

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
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-[0.3em] mb-10">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Abidjan, Côte d'Ivoire
              </div>
              <h1 className="text-6xl md:text-7xl lg:text-[110px] font-black leading-[0.85] mb-12 tracking-[-0.05em] text-gray-900 font-display">
                Gardez les mains <span className="text-amber-500">propres</span>, on se salit pour <span className="text-amber-500">vous</span>.
              </h1>
              <p className="text-lg lg:text-xl text-gray-500 mb-16 max-w-xl leading-relaxed font-medium">
                Une fois votre adresse enregistrée, notre <span className="text-amber-600 font-bold">"Système de Cartographie Optimisée"</span> prend le relais. Vous n'avez plus besoin de guetter le camion ou de négocier avec des ramasseurs informels. Votre maison entre dans notre zone de protection prioritaire.
                <br /><br />
                <span className="text-gray-900 font-black uppercase text-xs tracking-widest">Bénéfice :</span> Vous ne gérez plus, vous profitez.
              </p>
              <div 
                onClick={() => onSubscribe()}
                className="inline-flex items-center gap-6 cursor-pointer group"
              >
                <span className="text-xl lg:text-2xl font-black uppercase tracking-tighter text-amber-500 border-b-4 border-amber-500 pb-1 group-hover:text-amber-600 group-hover:border-amber-600 transition-all font-display">
                  Rejoindre l'aventure
                </span>
                <div className="w-12 h-12 rounded-full border-2 border-amber-500 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all">
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
                    alt="Collecteur de déchets ménagers LIPIDUS en action sur le terrain" 
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
                  <div className="w-14 h-14 lg:w-20 lg:h-20 bg-amber-500 rounded-2xl lg:rounded-3xl flex items-center justify-center">
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
      <section ref={sectionRefs.offres} id="offres" className="py-32 lg:py-48 bg-white">
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
                  onClick={() => offer.pro ? onPartner() : onSubscribe(offer.title)}
                  className={`cursor-pointer text-center py-6 lg:py-8 rounded-[25px] lg:rounded-[35px] font-black uppercase tracking-[0.2em] text-[10px] transition-all ${offer.pro ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700' : offer.popular ? 'bg-emerald-600 text-white shadow-2xl shadow-emerald-600/30 hover:bg-emerald-700' : 'bg-gray-900 text-white hover:bg-black'}`}
                >
                  {offer.pro ? "Devenir Partenaire" : "S'abonner"}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-32 lg:py-48 bg-[#f9f9f7] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="mb-24 lg:mb-32 text-center">
            <h2 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.5em] mb-8">Témoignages</h2>
            <p className="text-5xl md:text-7xl font-black tracking-[-0.05em] leading-[0.85] font-display text-black">Ce que disent <br /> nos clients.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                name: "Marie D.",
                role: "Résidente, Cocody",
                text: "Depuis que nous utilisons LIPIDUS, notre quartier est beaucoup plus propre. Le service est ponctuel et l'équipe très professionnelle."
              },
              {
                name: "Koffi A.",
                role: "Gérant de restaurant, Marcory",
                text: "La gestion des déchets pour notre commerce était un casse-tête. Avec l'abonnement LIPIDUS Pro, tout est géré sans accroc."
              },
              {
                name: "Sarah M.",
                role: "Mère de famille, Yopougon",
                text: "Une application simple à utiliser et un service client réactif. Je recommande vivement pour la tranquillité d'esprit au quotidien."
              }
            ].map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.2 }}
                className="bg-white p-10 lg:p-12 rounded-[30px] lg:rounded-[40px] shadow-xl shadow-black/5 relative"
              >
                <div className="flex gap-1 mb-6">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-lg lg:text-xl font-medium text-gray-600 mb-8 leading-relaxed">"{testimonial.text}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden">
                    <img 
                      src={images[`test_avatar_${i}`] || `https://i.pravatar.cc/150?u=lipidus_test_${i}`} 
                      alt={`Avis de ${testimonial.name}`} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <p className="font-black text-gray-900">{testimonial.name}</p>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Recruitment Section */}
      <section ref={sectionRefs.recrutement} id="recrutement" className="py-32 lg:py-48 bg-gray-900 text-white overflow-hidden">
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
                    alt="Équipe commerciale LIPIDUS pour la gestion des abonnements de collecte" 
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
      <section ref={sectionRefs.partner} className="py-32 lg:py-48 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-24 lg:gap-32 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
            >
              <h2 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.5em] mb-10">PARTENAIRES LIPIDUS PRO (Tricycles)</h2>
              <h3 className="text-5xl md:text-7xl lg:text-[80px] font-black tracking-[-0.05em] leading-[0.85] mb-12 font-display">Gagnez en 2 jours ce que les autres gagnent en une semaine.</h3>
              
              <div className="space-y-8 mb-16">
                <p className="text-xl font-bold text-emerald-600 leading-relaxed italic">
                  « Pourquoi fatiguer votre tricycle 7 jours sur 7 pour des miettes ? Rejoignez Lipidus Pro : travaillez moins, gagnez plus, et soyez payé à temps. »
                </p>
                
                <div className="grid gap-6">
                  {[
                    { title: "Liberté de temps", desc: "Vous ne travaillez que 2 jours par semaine. Le reste de la semaine, vous disposez de votre temps et vous reposez votre matériel." },
                    { title: "Paiement Garanti", desc: "Ne courez plus après l'argent des clients. C’est LIPIDUS qui vous paie directement à la fin du mois, sans discussion." },
                    { title: "Itinéraire Intelligent", desc: "Nous vous donnons une feuille de route précise. Pas de tours inutiles, vous allez droit au but pour économiser votre carburant." }
                  ].map((item, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-black text-gray-900 uppercase text-[10px] tracking-widest mb-1">{item.title}</p>
                        <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-sm font-bold text-gray-400 flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Les partenaires disposeront d'une application LIPIDUS dédiée pour les aider dans leurs tâches.
                </p>
              </div>

              <div className="bg-emerald-50/50 p-10 lg:p-14 rounded-[40px] lg:rounded-[60px] border border-emerald-100/50 backdrop-blur-sm">
                <p className="text-emerald-600 font-black text-4xl lg:text-6xl tracking-tighter mb-4 font-display">+400 000 FCFA / mois</p>
                <p className="text-emerald-800/40 font-black uppercase tracking-[0.2em] text-[10px]">Rentabilité maximale avec une organisation professionnelle</p>
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
                    alt="Partenaire professionnel LIPIDUS Pro pour la gestion des déchets d'entreprise" 
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
      <footer ref={sectionRefs.footer} id="contact" className="bg-gray-900 text-white pt-32 lg:pt-48 pb-16">
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
                  <li><div onClick={() => onSubscribe()} className="hover:text-white transition-colors cursor-pointer">S'abonner</div></li>
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

const RegistrationForm = ({ onBack, initialOffer }: { onBack: () => void, initialOffer?: string }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    commune: '',
    neighborhood: '',
    offer: initialOffer || '',
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
💎 *Offre choisie :* ${formData.offer || 'Non renseignée'}

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

  const isFormFilled = formData.fullName.trim() !== '' && formData.phone.length >= 8 && formData.commune.trim() !== '' && formData.offer !== '';
  const isFormValid = isFormFilled && location !== null;

  const getMissingInfo = () => {
    const missing = [];
    if (formData.fullName.trim() === '') missing.push("votre nom");
    if (formData.phone.length < 8) missing.push("un numéro de téléphone valide");
    if (formData.commune.trim() === '') missing.push("votre commune");
    if (formData.offer === '') missing.push("le choix d'une offre");
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

              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Offre choisie <span className="text-emerald-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Leaf className="h-5 w-5 text-gray-300 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <select
                    name="offer"
                    value={formData.offer}
                    onChange={(e) => setFormData(prev => ({ ...prev, offer: e.target.value }))}
                    className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-emerald-600/20 transition-all outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Choisir une offre</option>
                    <option value="Hebdomadaire">Hebdomadaire (1 500f / semaine)</option>
                    <option value="Mensuel">Mensuel (5 000f / mois)</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-6 flex items-center pointer-events-none">
                    <ArrowRight className="h-5 w-5 text-gray-300 rotate-90" />
                  </div>
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
  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    commune: '',
    equipmentType: 'Moto-tricycle',
    experience: '',
  });

  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setFormData(prev => ({ ...prev, email: u.email || '' }));
      }
    });
    return () => unsubAuth();
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<'pending' | 'validated' | 'rejected' | null>(null);

  useEffect(() => {
    if (user) {
      const unsub = onSnapshot(collection(db, 'partner_candidates'), (snapshot) => {
        let status: any = null;
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.userId === user.uid) {
            status = data.status;
          }
        });
        setPartnerStatus(status);
      });
      return () => unsub();
    }
  }, [user]);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError("Erreur de connexion Google: " + err.message);
    }
  };

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
    if (!formData.email) missing.push("Email");
    if (!formData.commune) missing.push("Commune");
    if (!location) missing.push("Position GPS");
    return missing;
  };

  const isFormFilled = formData.fullName && formData.phone && formData.email && formData.commune;
  const isFormValid = isFormFilled && location;

  const generateMessage = () => {
    const mapsLink = location ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}` : 'Non spécifiée';
    return `*NOUVELLE CANDIDATURE PARTENAIRE LIPIDUS PRO*%0A%0A` +
           `*Nom:* ${formData.fullName}%0A` +
           `*Tél:* ${formData.phone}%0A` +
           `*Email:* ${formData.email}%0A` +
           `*Commune:* ${formData.commune}%0A` +
           `*Équipement:* ${formData.equipmentType}%0A` +
           `*Expérience:* ${formData.experience || 'Non précisée'}%0A%0A` +
           `*Position GPS:* ${mapsLink}`;
  };

  const saveToFirestore = async () => {
    if (!isFormValid || !user) return;
    setIsSubmitting(true);
    try {
      const candidateId = `${user.uid}_${Date.now()}`;
      await setDoc(doc(db, 'partner_candidates', candidateId), {
        ...formData,
        location,
        userId: user.uid,
        submittedAt: new Date().toISOString(),
        status: 'pending'
      });
      return true;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'partner_candidates');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendToWhatsApp = async () => {
    const saved = await saveToFirestore();
    if (saved) {
      const message = generateMessage();
      window.open(`https://wa.me/2250566783088?text=${message}`, '_blank');
    }
  };

  const copyToClipboard = async () => {
    const saved = await saveToFirestore();
    if (saved) {
      const mapsLink = location ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}` : 'Non spécifiée';
      const text = `CANDIDATURE PARTENAIRE LIPIDUS PRO\n\n` +
                   `Nom: ${formData.fullName}\nTél: ${formData.phone}\nEmail: ${formData.email}\nCommune: ${formData.commune}\n` +
                   `Équipement: ${formData.equipmentType}\nExpérience: ${formData.experience || 'Non précisée'}\n\n` +
                   `Position GPS: ${mapsLink}`;
      
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const missingInfo = getMissingInfo();

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-10 text-center space-y-8"
        >
          <div 
            onClick={onBack}
            className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors mb-4"
          >
            <ArrowRight className="w-6 h-6 rotate-180" />
          </div>
          <div className="w-20 h-20 bg-indigo-100 rounded-[30px] flex items-center justify-center mx-auto">
            <Shield className="w-10 h-10 text-indigo-600" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black font-display">Accès Restreint</h2>
            <p className="text-gray-500 font-bold leading-relaxed">
              Pour accéder au portail partenaire LIPIDUS PRO, vous devez vous identifier avec votre compte Google.
            </p>
          </div>
          <button 
            onClick={handleGoogleLogin}
            className="w-full py-6 bg-gray-900 text-white rounded-[25px] font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-4 hover:bg-black transition-all shadow-xl shadow-gray-900/20"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
            Connexion avec Google
          </button>
          {error && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">{error}</p>}
        </motion.div>
      </div>
    );
  }

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
            
            {partnerStatus === 'validated' && (
              <motion.a 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                href="https://lipidus.netlify.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-4 px-10 py-5 bg-emerald-500 text-white rounded-[25px] text-xs font-black uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-2xl shadow-emerald-500/40 group"
              >
                Accéder à mon application LIPIDUS
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </motion.a>
            )}

            {partnerStatus === 'pending' && (
              <div className="mt-8 px-8 py-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 flex items-center gap-3">
                  <Clock className="w-4 h-4 animate-pulse" />
                  Candidature en cours d'examen
                </p>
              </div>
            )}
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
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email <span className="text-indigo-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Send className="h-5 w-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    readOnly
                    className="block w-full pl-14 pr-6 py-5 bg-gray-100 border-2 border-transparent rounded-[25px] text-sm font-bold text-gray-500 cursor-not-allowed outline-none"
                    placeholder="votre@email.com"
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
              onClick={isFormValid && !isSubmitting ? sendToWhatsApp : undefined}
              className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all cursor-pointer ${
                isFormValid && !isSubmitting
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-2xl shadow-indigo-600/30' 
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {isSubmitting ? 'Enregistrement...' : 'Envoyer ma candidature'}
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
    if (isFormFilled) {
      const message = generateMessage();
      window.open(`https://wa.me/2250566783088?text=${message}`, '_blank');
    }
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
  const [candidates, setCandidates] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'images' | 'candidates'>('images');

  useEffect(() => {
    // Listen to images in Firestore
    const unsubImages = onSnapshot(collection(db, 'settings'), (snapshot) => {
      const newImages: { [key: string]: string } = {};
      snapshot.forEach(docSnap => {
        if (docSnap.id.startsWith('img_')) {
          const key = docSnap.id.replace('img_', '');
          newImages[key] = docSnap.data().url;
        }
      });
      setImages(newImages);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings');
    });

    // Listen to candidates in Firestore
    const unsubCandidates = onSnapshot(collection(db, 'partner_candidates'), (snapshot) => {
      const newCandidates: any[] = [];
      snapshot.forEach(docSnap => {
        newCandidates.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort by date descending
      newCandidates.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setCandidates(newCandidates);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'partner_candidates');
    });

    // Listen to auth state
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    return () => {
      unsubImages();
      unsubCandidates();
      unsubAuth();
    };
  }, []);

  const updateCandidateStatus = async (id: string, status: 'pending' | 'validated' | 'rejected') => {
    if (user && user.email === "jorisahoussi4@gmail.com") {
      setIsSaving(true);
      try {
        await setDoc(doc(db, 'partner_candidates', id), { status }, { merge: true });
        setError('');
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `partner_candidates/${id}`);
      } finally {
        setIsSaving(false);
      }
    } else {
      setError("Vous devez être connecté avec le compte administrateur pour modifier le statut.");
    }
  };

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
            await setDoc(doc(db, 'settings', `img_${key}`), { url: base64 });
            setError('');
          } catch (err: any) {
            handleFirestoreError(err, OperationType.WRITE, `settings/img_${key}`);
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
              <p className="text-gray-500 text-sm font-bold">Gestion du site et des candidatures</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-gray-200 p-1 rounded-2xl mr-4">
              <button 
                onClick={() => setActiveTab('images')}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'images' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Images
              </button>
              <button 
                onClick={() => setActiveTab('candidates')}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'candidates' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Candidats ({candidates.length})
              </button>
            </div>
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

        {/* Tabs */}
        <div className="flex gap-4 mb-12">
          <button 
            onClick={() => setActiveTab('images')}
            className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'images' ? 'bg-gray-900 text-white shadow-xl shadow-gray-900/20' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
          >
            Gestion Images
          </button>
          <button 
            onClick={() => setActiveTab('candidates')}
            className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'candidates' ? 'bg-gray-900 text-white shadow-xl shadow-gray-900/20' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
          >
            Candidats Pro ({candidates.length})
          </button>
        </div>

        {activeTab === 'images' ? (
          <div className="grid gap-8">
            {[
              { key: 'collector', title: 'Image Principale (Héros)', desc: 'Grande image en haut de la page' },
              { key: 'hero_avatar_1', title: 'Avatar Héros 1', desc: 'Premier petit visage dans la section héros' },
              { key: 'hero_avatar_2', title: 'Avatar Héros 2', desc: 'Deuxième petit visage dans la section héros' },
              { key: 'hero_avatar_3', title: 'Avatar Héros 3', desc: 'Troisième petit visage dans la section héros' },
              { key: 'test_avatar_0', title: 'Avatar Témoignage 1', desc: 'Photo de Marie D.' },
              { key: 'test_avatar_1', title: 'Avatar Témoignage 2', desc: 'Photo de Koffi A.' },
              { key: 'test_avatar_2', title: 'Avatar Témoignage 3', desc: 'Photo de Sarah M.' },
              { key: 'commercials', title: 'Image Recrutement', desc: 'Image de la section équipe commerciale' },
              { key: 'partner', title: 'Image Partenaire Pro', desc: 'Image de la section LIPIDUS Pro' }
            ].map((zone) => (
              <div key={zone.key} className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8 items-center">
                <div className="w-full md:w-1/3 aspect-square bg-gray-100 rounded-3xl overflow-hidden relative">
                  {images[zone.key] ? (
                    <img src={images[zone.key]} alt={zone.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full relative">
                      <img 
                        src={
                          zone.key === 'collector' ? 'https://picsum.photos/seed/lipidus_collector/800/1000' :
                          zone.key.startsWith('hero_avatar_') ? `https://i.pravatar.cc/150?u=lipidus_${zone.key.split('_')[2]}` :
                          zone.key.startsWith('test_avatar_') ? `https://i.pravatar.cc/150?u=lipidus_test_${zone.key.split('_')[2]}` :
                          zone.key === 'commercials' ? 'https://picsum.photos/seed/lipidus_team/800/800' :
                          zone.key === 'partner' ? 'https://picsum.photos/seed/lipidus_partner/800/800' :
                          ''
                        } 
                        alt="Default" 
                        className="w-full h-full object-cover opacity-30 grayscale" 
                      />
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs font-black uppercase tracking-widest">Par défaut</div>
                    </div>
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
        ) : (
          <div className="space-y-6">
            {candidates.length === 0 ? (
              <div className="bg-white p-20 rounded-[40px] text-center border border-gray-100">
                <div className="w-20 h-20 bg-gray-50 rounded-[30px] flex items-center justify-center mx-auto mb-6">
                  <User className="w-10 h-10 text-gray-200" />
                </div>
                <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Aucune candidature pour le moment</p>
              </div>
            ) : (
              candidates.map((cand) => (
                <div key={cand.id} className="bg-white p-8 lg:p-10 rounded-[40px] shadow-sm border border-gray-100">
                  <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                    <div className="space-y-6 flex-1">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
                          <User className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black font-display">{cand.fullName}</h3>
                          <p className="text-xs font-bold text-gray-400">{new Date(cand.submittedAt).toLocaleString('fr-FR')}</p>
                        </div>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="flex items-center gap-3">
                          <Phone className="w-4 h-4 text-gray-300" />
                          <span className="text-sm font-bold">{cand.phone}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Send className="w-4 h-4 text-gray-300" />
                          <span className="text-sm font-bold">{cand.email}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <MapIcon className="w-4 h-4 text-gray-300" />
                          <span className="text-sm font-bold">{cand.commune}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Truck className="w-4 h-4 text-gray-300" />
                          <span className="text-sm font-bold">{cand.equipmentType}</span>
                        </div>
                      </div>

                      {cand.experience && (
                        <div className="p-4 bg-gray-50 rounded-2xl">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Expérience</p>
                          <p className="text-sm font-medium text-gray-600">{cand.experience}</p>
                        </div>
                      )}
                    </div>

                      <div className="w-full md:w-auto space-y-4">
                        <a 
                          href={`https://www.google.com/maps?q=${cand.location.latitude},${cand.location.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-3 w-full md:w-auto px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                        >
                          <MapPin className="w-4 h-4" />
                          Voir sur Map
                        </a>
                        <div className="flex flex-col gap-2">
                          <div className="text-center mb-2">
                            <span className={`inline-block px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              cand.status === 'validated' ? 'bg-emerald-50 text-emerald-600' : 
                              cand.status === 'rejected' ? 'bg-red-50 text-red-600' : 
                              'bg-amber-50 text-amber-600'
                            }`}>
                              {cand.status === 'validated' ? 'Validé' : cand.status === 'rejected' ? 'Refusé' : 'En attente'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => updateCandidateStatus(cand.id, 'validated')}
                              className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all"
                            >
                              Valider
                            </button>
                            <button 
                              onClick={() => updateCandidateStatus(cand.id, 'rejected')}
                              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-600 transition-all"
                            >
                              Refuser
                            </button>
                          </div>
                        </div>
                      </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const LipiMascot = () => (
  <div className="relative flex flex-col items-center">
    {/* Juggling Sparks */}
    <div className="absolute -top-12 w-24 h-24">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{
            x: [Math.cos(i * 2) * 30, Math.cos(i * 2 + 2) * 30, Math.cos(i * 2) * 30],
            y: [Math.sin(i * 2) * 30, Math.sin(i * 2 + 2) * 30, Math.sin(i * 2) * 30],
            scale: [0.8, 1.2, 0.8],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.5,
            ease: "easeInOut",
          }}
          className="absolute left-1/2 top-1/2 w-3 h-3 bg-amber-400 rounded-full blur-[1px] shadow-lg shadow-amber-400/50"
        />
      ))}
    </div>

    <div className="relative">
      {/* Arms */}
      <div className="absolute inset-0 flex justify-between items-center -mx-4 z-0">
        <motion.div 
          animate={{ rotate: [-20, 20, -20] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-6 h-2 bg-emerald-400 rounded-full origin-right border border-white/10" 
        />
        <motion.div 
          animate={{ rotate: [20, -20, 20] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-6 h-2 bg-emerald-400 rounded-full origin-left border border-white/10" 
        />
      </div>

      {/* Mascot Body */}
      <motion.div
        animate={{
          y: [0, -8, 0],
          rotate: [-1, 1, -1],
          scale: [1, 1.02, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative w-20 h-24 bg-emerald-500 rounded-t-[40px] rounded-b-[20px] shadow-2xl shadow-emerald-500/20 flex flex-col items-center justify-center overflow-hidden z-10"
      >
        {/* Shine */}
        <div className="absolute top-2 left-4 w-6 h-3 bg-white/20 rounded-full blur-[2px] rotate-[-15deg]" />
        
        {/* Eyes Container */}
        <div className="flex gap-4 mb-2">
          <div className="w-3 h-3 bg-black rounded-full relative">
            <div className="absolute top-0.5 left-0.5 w-1 h-1 bg-white rounded-full" />
          </div>
          <div className="w-3 h-3 bg-black rounded-full relative">
            <div className="absolute top-0.5 left-0.5 w-1 h-1 bg-white rounded-full" />
          </div>
        </div>
        
        {/* Mouth */}
        <motion.div 
          animate={{ width: [12, 16, 12] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-4 h-1.5 bg-black/20 rounded-full" 
        />
      </motion.div>

      {/* Legs */}
      <div className="flex gap-6 -mt-2 z-0 justify-center">
        <motion.div 
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.75, repeat: Infinity }}
          className="w-3 h-6 bg-emerald-600 rounded-full border border-white/10" 
        />
        <motion.div 
          animate={{ y: [-4, 0, -4] }}
          transition={{ duration: 0.75, repeat: Infinity }}
          className="w-3 h-6 bg-emerald-600 rounded-full border border-white/10" 
        />
      </div>
    </div>

    {/* Shadow */}
    <motion.div
      animate={{
        scale: [1, 0.8, 1],
        opacity: [0.2, 0.1, 0.2],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="w-16 h-3 bg-black rounded-full blur-md mt-4"
    />
  </div>
);

const MeltingLoader = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#f9f9f7]"
  >
    <div className="relative mb-12">
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          rotate: [0, 180, 360],
          borderRadius: ["30%", "50%", "30%"],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="w-32 h-32 bg-amber-400/20 blur-2xl"
      />
      <motion.div
        animate={{
          scale: [1.3, 1, 1.3],
          rotate: [360, 180, 0],
          borderRadius: ["50%", "30%", "50%"],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute inset-0 w-32 h-32 bg-emerald-500/20 blur-2xl"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <LipiMascot />
      </div>
    </div>
    
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="text-center"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-400">Lipidus en mouvement</p>
      <div className="flex justify-center gap-1 mt-3">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            className="w-1 h-1 bg-amber-400 rounded-full"
          />
        ))}
      </div>
    </motion.div>
  </motion.div>
);

export default function App() {
  const [view, setView] = useState<'home' | 'register' | 'partner' | 'recruit' | 'admin'>('home');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [pendingView, setPendingView] = useState<'home' | 'register' | 'partner' | 'recruit' | 'admin' | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<string>('');

  const handleNavigate = (nextView: 'home' | 'register' | 'partner' | 'recruit' | 'admin', offer: string = '') => {
    setSelectedOffer(offer);
    setIsTransitioning(true);
    setPendingView(nextView);
    
    // Artificial delay for the addictive loader
    setTimeout(() => {
      setView(nextView);
      window.scrollTo(0, 0);
      setTimeout(() => {
        setIsTransitioning(false);
        setPendingView(null);
      }, 600);
    }, 800);
  };

  const sectionRefs = {
    hero: useRef(null),
    offres: useRef(null),
    recrutement: useRef(null),
    partner: useRef(null),
    footer: useRef(null)
  };

  return (
    <ErrorBoundary>
      <AnimatePresence>
        {isTransitioning && <MeltingLoader />}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!isTransitioning && view === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <LandingPage 
              onSubscribe={(offer) => handleNavigate('register', offer)} 
              onPartner={() => handleNavigate('partner')}
              onRecruit={() => handleNavigate('recruit')}
              onAdmin={() => handleNavigate('admin')}
              sectionRefs={sectionRefs}
            />
            <LipiCompanion sectionRefs={sectionRefs} />
          </motion.div>
        )}
        {!isTransitioning && view === 'register' && (
          <motion.div
            key="register"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 1.02 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <RegistrationForm onBack={() => handleNavigate('home')} initialOffer={selectedOffer} />
          </motion.div>
        )}
        {!isTransitioning && view === 'partner' && (
          <motion.div
            key="partner"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 1.02 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <PartnerForm onBack={() => handleNavigate('home')} />
          </motion.div>
        )}
        {!isTransitioning && view === 'recruit' && (
          <motion.div
            key="recruit"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 1.02 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <RecruitmentForm onBack={() => handleNavigate('home')} />
          </motion.div>
        )}
        {!isTransitioning && view === 'admin' && (
          <motion.div
            key="admin"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 1.02 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <AdminPage onBack={() => handleNavigate('home')} />
          </motion.div>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
}
