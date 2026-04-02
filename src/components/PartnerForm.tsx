import React, { useState, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Copy, Check, Navigation, RefreshCw, User, Phone, Send, Map as MapIcon, AlertTriangle, CheckCircle2, ArrowRight, Shield, Truck, Briefcase } from 'lucide-react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { MapRecenter, LocationPicker } from './MapComponents';
import { LocationData } from '../types';

interface PartnerFormProps {
  onBack: () => void;
}

export const PartnerForm = ({ onBack }: PartnerFormProps) => {
  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    commune: '',
    equipmentType: 'Moto-tricycle',
    experience: '',
  });

  const [location, setLocation] = useState<LocationData | null>(null);
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
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
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

  const isFormFilled = formData.fullName && formData.phone && formData.email && formData.commune;
  const isFormValid = isFormFilled && location;

  const generateMessage = () => {
    const mapsLink = location ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}` : 'Non spécifiée';
    return `*NOUVELLE CANDIDATURE PARTENAIRE LIPIDUS PRO*\n\n` +
           `*Nom:* ${formData.fullName}\n` +
           `*Tél:* ${formData.phone}\n` +
           `*Email:* ${formData.email}\n` +
           `*Commune:* ${formData.commune}\n` +
           `*Équipement:* ${formData.equipmentType}\n` +
           `*Expérience:* ${formData.experience || 'Non précisée'}\n\n` +
           `*Position GPS:* ${mapsLink}`;
  };

  const sendToWhatsApp = () => {
    const encodedText = encodeURIComponent(generateMessage());
    window.open(`https://wa.me/2250566783088?text=${encodedText}`, '_blank');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateMessage()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const missingInfo = [];
  if (!formData.fullName) missingInfo.push("Nom complet");
  if (!formData.phone) missingInfo.push("Numéro de téléphone");
  if (!formData.email) missingInfo.push("Email");
  if (!formData.commune) missingInfo.push("Commune");
  if (!location) missingInfo.push("Position GPS");

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-10 text-center space-y-8">
          <div onClick={onBack} className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors mb-4"><ArrowRight className="w-6 h-6 rotate-180" /></div>
          <div className="w-20 h-20 bg-indigo-100 rounded-[30px] flex items-center justify-center mx-auto"><Shield className="w-10 h-10 text-indigo-600" /></div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black font-display">Accès Restreint</h2>
            <p className="text-gray-500 font-bold leading-relaxed">Pour accéder au portail partenaire LIPIDUS PRO, vous devez vous identifier avec votre compte Google.</p>
          </div>
          <button onClick={handleGoogleLogin} className="w-full py-6 bg-gray-900 text-white rounded-[25px] font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-4 hover:bg-black transition-all shadow-xl shadow-gray-900/20">
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />Connexion avec Google
          </button>
          {error && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">{error}</p>}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 font-sans flex flex-col items-center justify-center p-0 md:p-8 lg:p-12 selection:bg-indigo-100 selection:text-indigo-900">
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="w-full min-h-screen md:min-h-0 md:max-w-2xl bg-white md:rounded-[40px] lg:rounded-[60px] shadow-2xl shadow-indigo-900/5 border border-gray-100 overflow-hidden flex flex-col">
        <div className="bg-gray-900 p-10 lg:p-16 pb-12 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20"><div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#4f46e5,transparent_70%)]" /></div>
          <div onClick={onBack} className="absolute top-10 left-10 lg:top-16 lg:left-16 p-3 bg-white/10 backdrop-blur-md rounded-2xl hover:bg-white/20 text-white transition-all z-20 cursor-pointer group"><ArrowRight className="w-6 h-6 rotate-180 group-hover:-translate-x-1 transition-transform" /></div>
          <div className="relative z-10 flex flex-col items-center text-center">
            <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-4 text-white font-display">LIPIDUS <span className="text-indigo-400">PRO</span></h1>
            <p className="text-indigo-200/60 font-black uppercase tracking-[0.3em] text-[10px]">Portail Partenaires & Logistique</p>
          </div>
        </div>

        <div className="p-8 lg:p-16 space-y-12">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">01</span>Profil Partenaire</h2>
              {isFormFilled && <CheckCircle2 className="w-6 h-6 text-indigo-500" />}
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 lg:gap-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom Complet <span className="text-indigo-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><User className="h-5 w-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" /></div>
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-indigo-600/20 transition-all outline-none placeholder:text-gray-300" placeholder="Ex: Kouassi Koffi" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Téléphone <span className="text-indigo-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><Phone className="h-5 w-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" /></div>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-indigo-600/20 transition-all outline-none placeholder:text-gray-300" placeholder="Ex: 0707..." />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email <span className="text-indigo-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><Send className="h-5 w-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" /></div>
                  <input type="email" name="email" value={formData.email} readOnly className="block w-full pl-14 pr-6 py-5 bg-gray-100 border-2 border-transparent rounded-[25px] text-sm font-bold text-gray-500 cursor-not-allowed outline-none" placeholder="votre@email.com" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Commune <span className="text-indigo-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><MapIcon className="h-5 w-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" /></div>
                  <input type="text" name="commune" value={formData.commune} onChange={handleInputChange} className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-indigo-600/20 transition-all outline-none placeholder:text-gray-300" placeholder="Ex: Yopougon" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Type d'équipement <span className="text-indigo-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><Truck className="h-5 w-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" /></div>
                  <select name="equipmentType" value={formData.equipmentType} onChange={handleInputChange} className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-indigo-600/20 transition-all outline-none appearance-none cursor-pointer">
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
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><Briefcase className="h-5 w-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" /></div>
                <input type="text" name="experience" value={formData.experience} onChange={handleInputChange} className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-indigo-600/20 transition-all outline-none placeholder:text-gray-300" placeholder="Ex: 2 ans dans la collecte..." />
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">02</span>Zone d'activité</h2>
              {location && <CheckCircle2 className="w-6 h-6 text-indigo-500" />}
            </div>

            {!location && (
              <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-[30px] p-6 flex gap-4 items-start backdrop-blur-sm">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0"><MapPin className="w-5 h-5 text-indigo-600" /></div>
                <p className="text-xs text-indigo-800 leading-relaxed font-bold">Indiquez votre zone de résidence ou de stationnement habituelle pour optimiser les tournées.</p>
              </div>
            )}

            {error && <div className="p-5 bg-red-50 border border-red-100 rounded-[25px] text-red-600 text-[10px] font-black uppercase tracking-widest text-center">{error}</div>}

            <div onClick={(e) => { e.preventDefault(); if (isFormFilled) getPosition(); }} className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all active:scale-95 cursor-pointer ${!isFormFilled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : location ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-200 hover:bg-indigo-100' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xl shadow-indigo-600/30'}`}>
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
              {loading ? 'Recherche...' : location ? 'Mettre à jour ma position' : 'Trouver ma position'}
            </div>

            <div className="h-[400px] lg:h-[500px] w-full rounded-[40px] lg:rounded-[60px] overflow-hidden border-4 border-gray-50 relative z-0 shadow-2xl">
              <MapContainer center={location ? [location.latitude, location.longitude] : [5.359951, -4.008256]} zoom={location ? 19 : 12} scrollWheelZoom={true} className="h-full w-full z-0" attributionControl={false}>
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
                <LocationPicker location={location} setLocation={setLocation} />
                {location && <MapRecenter lat={location.latitude} lng={location.longitude} zoom={19} />}
              </MapContainer>
            </div>
          </div>

          <div className="space-y-6 pt-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] flex items-center gap-3 mb-8"><span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">03</span>Validation</h2>
            <div onClick={isFormValid ? sendToWhatsApp : undefined} className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all cursor-pointer ${isFormValid ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-2xl shadow-indigo-600/30' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
              <Send className="w-5 h-5" />Envoyer ma candidature
            </div>
            <div onClick={isFormValid ? copyToClipboard : undefined} className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all cursor-pointer ${isFormValid ? 'bg-white border-2 border-gray-100 text-gray-900 hover:bg-gray-50 active:scale-95' : 'bg-transparent border-2 border-gray-50 text-gray-200 cursor-not-allowed'}`}>
              {copied ? <><Check className="w-5 h-5 text-indigo-500" />Copié !</> : <><Copy className="w-5 h-5" />Copier les infos</>}
            </div>
            {!isFormValid && (
              <div className="mt-8 p-8 bg-red-50/50 rounded-[30px] border border-red-100/50">
                <p className="text-[10px] text-red-600 font-black uppercase tracking-widest mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Informations manquantes :</p>
                <ul className="space-y-2">
                  {missingInfo.map((info, i) => (
                    <li key={i} className="text-xs text-red-800/60 font-bold flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-red-400" />{info}</li>
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
