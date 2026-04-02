import React, { useState, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Copy, Check, Navigation, RefreshCw, User, Phone, Home, Send, Map as MapIcon, AlertTriangle, CheckCircle2, ArrowRight, Leaf } from 'lucide-react';
import { MapContainer, TileLayer, Circle } from 'react-leaflet';
import { LocationData } from '../types';
import { MapRecenter, LocationPicker } from './MapComponents';

interface RegistrationFormProps {
  onBack: () => void;
}

export const RegistrationForm = ({ onBack }: RegistrationFormProps) => {
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
          if (newLocation.accuracy <= 3) stopWatching();
        }
      },
      (err) => {
        if (!bestLocation) {
          let message = "Une erreur est survenue lors de la récupération de la position.";
          if (err.code === 1) message = "Permission refusée. Veuillez autoriser l'accès à la position.";
          if (err.code === 2) message = "Position non disponible.";
          if (err.code === 3) message = "Délai d'attente dépassé.";
          setError(message);
          stopWatching();
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );

    timeoutId = setTimeout(() => stopWatching(), 20000);
  };

  const generateMessageText = () => {
    return `📋 *NOUVELLE INSCRIPTION LIPIDUS* 🗑️\n` +
           `👤 *Client :* ${formData.fullName || 'Non renseigné'}\n` +
           `📞 *Téléphone :* ${formData.phone || 'Non renseigné'}\n` +
           `🏙️ *Commune :* ${formData.commune || 'Non renseigné'}\n` +
           `📍 *Quartier/Repère :* ${formData.neighborhood || 'Non renseigné'}\n\n` +
           `🗺️ *Coordonnées GPS :*\n` +
           `Latitude: ${location?.latitude.toFixed(6)}\n` +
           `Longitude: ${location?.longitude.toFixed(6)}\n` +
           `🔗 *Lien Google Maps :*\n` +
           `https://www.google.com/maps?q=${location?.latitude},${location?.longitude}`;
  };

  const copyToClipboard = () => {
    if (!location) return;
    navigator.clipboard.writeText(generateMessageText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const sendToWhatsApp = () => {
    if (!location) return;
    const encodedText = encodeURIComponent(generateMessageText());
    window.open(`https://wa.me/2250566783088?text=${encodedText}`, '_blank');
  };

  const isFormFilled = formData.fullName.trim() !== '' && formData.phone.length >= 8 && formData.commune.trim() !== '';
  const isFormValid = isFormFilled && location !== null;

  const missingInfo = [];
  if (formData.fullName.trim() === '') missingInfo.push("votre nom");
  if (formData.phone.length < 8) missingInfo.push("un numéro de téléphone valide");
  if (formData.commune.trim() === '') missingInfo.push("votre commune");
  if (!location) missingInfo.push("votre position GPS (bouton vert)");

  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 font-sans flex flex-col items-center justify-center p-0 md:p-8 lg:p-12 selection:bg-emerald-100 selection:text-emerald-900">
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full min-h-screen md:min-h-0 md:max-w-2xl bg-white md:rounded-[40px] lg:rounded-[60px] shadow-2xl shadow-emerald-900/5 border border-gray-100 overflow-hidden flex flex-col"
      >
        <div className="bg-emerald-50/50 p-10 lg:p-16 pb-12 relative overflow-hidden border-b border-emerald-100/50">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-100/30 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div onClick={onBack} className="absolute top-10 left-10 lg:top-16 lg:left-16 p-3 bg-white rounded-2xl shadow-sm hover:bg-emerald-50 hover:text-emerald-600 transition-all z-20 cursor-pointer group">
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

        <div className="p-8 lg:p-16 space-y-12">
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
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-emerald-600/20 transition-all outline-none placeholder:text-gray-300" placeholder="Ex: Jean Dupont" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Téléphone <span className="text-emerald-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-300 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} maxLength={15} className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-emerald-600/20 transition-all outline-none placeholder:text-gray-300" placeholder="Ex: 0566783088" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Commune <span className="text-emerald-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <MapIcon className="h-5 w-5 text-gray-300 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <input type="text" name="commune" value={formData.commune} onChange={handleInputChange} className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-emerald-600/20 transition-all outline-none placeholder:text-gray-300" placeholder="Ex: Cocody" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Quartier ou repère</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Home className="h-5 w-5 text-gray-300 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <input type="text" name="neighborhood" value={formData.neighborhood} onChange={handleInputChange} className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-emerald-600/20 transition-all outline-none placeholder:text-gray-300" placeholder="Ex: Près de la pharmacie..." />
                </div>
              </div>
            </div>
          </div>

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
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0"><MapPin className="w-5 h-5 text-emerald-600" /></div>
                <p className="text-xs text-emerald-800 leading-relaxed font-bold">Étape obligatoire. Cliquez sur la carte pour indiquer votre position ou utilisez le bouton de localisation automatique.</p>
              </div>
            )}

            {error && <div className="p-5 bg-red-50 border border-red-100 rounded-[25px] text-red-600 text-[10px] font-black uppercase tracking-widest text-center">{error}</div>}

            <AnimatePresence>
              {successMsg && (
                <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -10, height: 0 }} className="overflow-hidden">
                  <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-[25px] text-emerald-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 justify-center mb-4">
                    <CheckCircle2 className="w-4 h-4" />{successMsg}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div onClick={(e) => { e.preventDefault(); if (isFormFilled) getPosition(); }} className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all active:scale-95 cursor-pointer ${!isFormFilled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : location ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200 hover:bg-emerald-100' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xl shadow-emerald-600/30'}`}>
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
              {loading ? 'Recherche...' : location ? 'Mettre à jour ma position' : 'Trouver ma position'}
            </div>

            <div className="h-[400px] lg:h-[500px] w-full rounded-[40px] lg:rounded-[60px] overflow-hidden border-4 border-gray-50 relative z-0 shadow-2xl">
              <MapContainer center={location ? [location.latitude, location.longitude] : [5.359951, -4.008256]} zoom={location ? 19 : 12} scrollWheelZoom={true} className="h-full w-full z-0" attributionControl={false}>
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
                <LocationPicker location={location} setLocation={setLocation} />
                {location && <MapRecenter lat={location.latitude} lng={location.longitude} zoom={19} />}
                {location && location.accuracy > 0 && location.accuracy < 500 && (
                  <Circle center={[location.latitude, location.longitude]} radius={location.accuracy} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2, weight: 1 }} />
                )}
              </MapContainer>
            </div>
            
            {location && (
               <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-900 p-8 rounded-[35px] lg:rounded-[50px] shadow-2xl">
                 <p className="text-xs text-gray-400 leading-relaxed flex items-start gap-4">
                   <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5 text-white" /></div>
                   <span className="font-bold"><strong className="text-emerald-500 uppercase tracking-widest block mb-2">Précision Chirurgicale :</strong> Zoomez au maximum et déplacez le marqueur pour le placer <span className="text-white">exactement sur votre toit</span>.</span>
                 </p>
               </motion.div>
            )}
          </div>

          <div className="space-y-6 pt-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] flex items-center gap-3 mb-8">
              <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">03</span>
              Validation
            </h2>

            <div onClick={isFormValid ? sendToWhatsApp : undefined} className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all cursor-pointer ${isFormValid ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-2xl shadow-emerald-600/30' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
              <Send className="w-5 h-5" />Envoyer via WhatsApp
            </div>

            <div onClick={isFormValid ? copyToClipboard : undefined} className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all cursor-pointer ${isFormValid ? 'bg-white border-2 border-gray-100 text-gray-900 hover:bg-gray-50 active:scale-95' : 'bg-transparent border-2 border-gray-50 text-gray-200 cursor-not-allowed'}`}>
              {copied ? <><Check className="w-5 h-5 text-emerald-500" />Copié !</> : <><Copy className="w-5 h-5" />Copier les infos</>}
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
