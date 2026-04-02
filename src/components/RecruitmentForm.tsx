import React, { useState, ChangeEvent } from 'react';
import { motion } from 'motion/react';
import { Copy, Check, Phone, Send, Map as MapIcon, AlertTriangle, CheckCircle2, ArrowRight, Star, User, Calendar, Briefcase } from 'lucide-react';

interface RecruitmentFormProps {
  onBack: () => void;
}

export const RecruitmentForm = ({ onBack }: RecruitmentFormProps) => {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    commune: '',
    age: '',
    experience: '',
    motivation: '',
  });
  const [copied, setCopied] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isFormFilled = formData.fullName && formData.phone && formData.commune && formData.age;

  const generateMessage = () => {
    return `*NOUVELLE CANDIDATURE FORCE DE VENTE LIPIDUS*\n\n` +
           `*Nom:* ${formData.fullName}\n` +
           `*Tél:* ${formData.phone}\n` +
           `*Âge:* ${formData.age} ans\n` +
           `*Commune:* ${formData.commune}\n` +
           `*Expérience:* ${formData.experience || 'Non précisée'}\n` +
           `*Motivation:* ${formData.motivation || 'Non précisée'}`;
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
  if (!formData.age) missingInfo.push("Âge");
  if (!formData.commune) missingInfo.push("Commune");

  return (
    <div className="min-h-screen bg-amber-50/30 text-gray-900 font-sans flex flex-col items-center justify-center p-0 md:p-8 lg:p-12 selection:bg-amber-100 selection:text-amber-900">
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="w-full min-h-screen md:min-h-0 md:max-w-2xl bg-white md:rounded-[40px] lg:rounded-[60px] shadow-2xl shadow-amber-900/5 border border-gray-100 overflow-hidden flex flex-col">
        <div className="bg-amber-500 p-10 lg:p-16 pb-12 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20"><div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#ffffff,transparent_70%)]" /></div>
          <div onClick={onBack} className="absolute top-10 left-10 lg:top-16 lg:left-16 p-3 bg-white/20 backdrop-blur-md rounded-2xl hover:bg-white/30 text-white transition-all z-20 cursor-pointer group"><ArrowRight className="w-6 h-6 rotate-180 group-hover:-translate-x-1 transition-transform" /></div>
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-xl"><Star className="w-6 h-6 text-amber-500" /></div>
            <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-4 text-white font-display">LIPIDUS <span className="text-amber-200">TALENT</span></h1>
            <p className="text-amber-100/60 font-black uppercase tracking-[0.3em] text-[10px]">Rejoindre la Force de Vente</p>
          </div>
        </div>

        <div className="p-8 lg:p-16 space-y-12">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">01</span>Informations Candidat</h2>
              {isFormFilled && <CheckCircle2 className="w-6 h-6 text-amber-500" />}
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 lg:gap-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom Complet <span className="text-amber-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><User className="h-5 w-5 text-gray-300 group-focus-within:text-amber-500 transition-colors" /></div>
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-amber-600/20 transition-all outline-none placeholder:text-gray-300" placeholder="Ex: Kouassi Koffi" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Téléphone <span className="text-amber-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><Phone className="h-5 w-5 text-gray-300 group-focus-within:text-amber-500 transition-colors" /></div>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-amber-600/20 transition-all outline-none placeholder:text-gray-300" placeholder="Ex: 0707..." />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Âge <span className="text-amber-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><Calendar className="h-5 w-5 text-gray-300 group-focus-within:text-amber-500 transition-colors" /></div>
                  <input type="number" name="age" value={formData.age} onChange={handleInputChange} className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-amber-600/20 transition-all outline-none placeholder:text-gray-300" placeholder="Ex: 25" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Commune <span className="text-amber-500">*</span></label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><MapIcon className="h-5 w-5 text-gray-300 group-focus-within:text-amber-500 transition-colors" /></div>
                  <input type="text" name="commune" value={formData.commune} onChange={handleInputChange} className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-amber-600/20 transition-all outline-none placeholder:text-gray-300" placeholder="Ex: Cocody" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Expérience en vente</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><Briefcase className="h-5 w-5 text-gray-300 group-focus-within:text-amber-500 transition-colors" /></div>
                <input type="text" name="experience" value={formData.experience} onChange={handleInputChange} className="block w-full pl-14 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-amber-600/20 transition-all outline-none placeholder:text-gray-300" placeholder="Ex: 1 an chez..." />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Motivation</label>
              <textarea name="motivation" value={formData.motivation} onChange={handleInputChange as any} rows={4} className="block w-full px-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-[25px] text-sm font-bold focus:bg-white focus:border-amber-600/20 transition-all outline-none placeholder:text-gray-300 resize-none" placeholder="Pourquoi voulez-vous rejoindre LIPIDUS ?" />
            </div>
          </div>

          <div className="space-y-6 pt-8">
            <div onClick={isFormFilled ? sendToWhatsApp : undefined} className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all cursor-pointer ${isFormFilled ? 'bg-amber-500 text-white hover:bg-amber-600 active:scale-95 shadow-2xl shadow-amber-600/30' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
              <Send className="w-5 h-5" />Postuler via WhatsApp
            </div>
            <div onClick={isFormFilled ? copyToClipboard : undefined} className={`w-full py-6 lg:py-8 rounded-[30px] lg:rounded-[40px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-4 transition-all cursor-pointer ${isFormFilled ? 'bg-white border-2 border-gray-100 text-gray-900 hover:bg-gray-50 active:scale-95' : 'bg-transparent border-2 border-gray-50 text-gray-200 cursor-not-allowed'}`}>
              {copied ? <><Check className="w-5 h-5 text-amber-500" />Copié !</> : <><Copy className="w-5 h-5" />Copier les infos</>}
            </div>
            {!isFormFilled && (
              <div className="mt-8 p-8 bg-amber-50/50 rounded-[30px] border border-amber-100/50">
                <p className="text-[10px] text-amber-600 font-black uppercase tracking-widest mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Informations manquantes :</p>
                <ul className="space-y-2">
                  {missingInfo.map((info, i) => (
                    <li key={i} className="text-xs text-amber-800/60 font-bold flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-amber-400" />{info}</li>
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
