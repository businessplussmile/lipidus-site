import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Shield, Leaf, Menu, X, Facebook, Twitter, Instagram, Phone, Map as MapIcon, CheckCircle2, Star, Check } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { GoogleGenAI } from "@google/genai";
import { handleFirestoreError } from '../utils/firestore';
import { OperationType } from '../types';

interface LandingPageProps {
  onSubscribe: () => void;
  onPartner: () => void;
  onRecruit: () => void;
  onAdmin: () => void;
}

export const LandingPage = ({ onSubscribe, onPartner, onRecruit, onAdmin }: LandingPageProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [images, setImages] = useState<{ [key: string]: string }>({});
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
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
        loadInitialImages();
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings');
    });

    const loadInitialImages = async () => {
      const storedImages = localStorage.getItem('lipidus_images');
      if (storedImages) {
        setImages(JSON.parse(storedImages));
        setIsGenerating(false);
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
      } catch (error) {
        console.error("Error generating images:", error);
      } finally {
        setIsGenerating(false);
      }
    };

    return () => unsub();
  }, []);

  const ImageSkeleton = () => (
    <div className="w-full h-full bg-gray-200 animate-pulse flex items-center justify-center">
      <Leaf className="w-12 h-12 text-gray-300 animate-bounce" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 overflow-x-hidden font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-2xl border-b border-gray-100/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex justify-between items-center h-20 lg:h-24">
            <div className="flex items-center gap-3">
              <span className="text-2xl lg:text-3xl font-black tracking-tighter text-emerald-600 font-display">LIPIDUS</span>
            </div>
            
            <div className="hidden md:flex items-center gap-12">
              <a href="#offres" className="text-[10px] font-black text-gray-400 hover:text-emerald-600 transition-all uppercase tracking-[0.3em]">Nos Offres</a>
              <div onClick={onRecruit} className="cursor-pointer text-[10px] font-black text-gray-400 hover:text-amber-600 transition-all uppercase tracking-[0.3em]">Recrutement</div>
              <a href="#contact" className="text-[10px] font-black text-gray-400 hover:text-emerald-600 transition-all uppercase tracking-[0.3em]">Contact</a>
              <div onClick={onPartner} className="cursor-pointer text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] hover:text-indigo-600 transition-all">Devenir Partenaire</div>
              <div onClick={onSubscribe} className="cursor-pointer text-emerald-600 text-[10px] font-black uppercase tracking-[0.3em] border-b-2 border-emerald-600 pb-1 hover:text-emerald-700 hover:border-emerald-700 transition-all">S'abonner</div>
            </div>

            <div className="md:hidden">
              <div onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 cursor-pointer">
                {isMenuOpen ? <X className="w-8 h-8 text-gray-900" /> : <Menu className="w-8 h-8 text-gray-900" />}
              </div>
            </div>
          </div>
        </div>

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
                <div onClick={() => { setIsMenuOpen(false); onRecruit(); }} className="text-gray-900 text-2xl font-black uppercase tracking-tighter hover:text-amber-600 transition-colors cursor-pointer">Recrutement</div>
                <a href="#contact" onClick={() => setIsMenuOpen(false)} className="block text-2xl font-black text-gray-900 uppercase tracking-tighter">Contact</a>
                <div onClick={() => { setIsMenuOpen(false); onPartner(); }} className="text-gray-900 text-2xl font-black uppercase tracking-tighter hover:text-emerald-600 transition-colors cursor-pointer">Devenir Partenaire</div>
                <div onClick={() => { setIsMenuOpen(false); onSubscribe(); }} className="text-emerald-600 text-2xl font-black uppercase tracking-tighter border-b-4 border-emerald-600 inline-block">S'abonner</div>
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
                Gardez les mains <span className="text-emerald-600">propres</span>, on se salit pour <span className="text-emerald-600">vous</span>.
              </h1>
              <p className="text-lg lg:text-xl text-gray-500 mb-16 max-w-xl leading-relaxed font-medium">
                Une fois votre adresse enregistrée, notre <span className="text-emerald-600 font-bold">"Système de Cartographie Optimisée"</span> prend le relais. Vous n'avez plus besoin de guetter le camion ou de négocier avec des ramasseurs informels. Votre maison entre dans notre zone de protection prioritaire.
                <br /><br />
                <span className="text-gray-900 font-black uppercase text-xs tracking-widest">Bénéfice :</span> Vous ne gérez plus, vous profitez.
              </p>
              <div onClick={onSubscribe} className="inline-flex items-center gap-6 cursor-pointer group">
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
                    alt="Collecteur de déchets ménagers LIPIDUS en action sur le terrain" 
                    className="w-full h-full object-cover scale-110 hover:scale-100 transition-transform duration-1000"
                    referrerPolicy="no-referrer"
                  />
                ) : <ImageSkeleton />}
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
              { title: "Hebdomadaire", price: "1 500f", period: "/ semaine", desc: "Idéal pour tester notre efficacité.", features: ["Ramassage 2x par semaine", "Sac poubelle offert", "Désinfection des bacs"] },
              { title: "Mensuel", price: "5 000f", period: "/ mois", desc: "La tranquillité d'esprit au quotidien.", features: ["Ramassage 2x par semaine", "Sac poubelle offert", "Désinfection des bacs"], popular: true },
              { title: "LIPIDUS Pro", price: "+400 000f", period: "/ mois", desc: "Devenez partenaire avec votre moto-tricycle.", features: ["Partenariat logistique", "Revenus garantis", "Support technique"], pro: true }
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
                    alt="Équipe commerciale LIPIDUS pour la gestion des abonnements de collecte" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                    referrerPolicy="no-referrer"
                  />
                ) : <ImageSkeleton />}
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
              <h3 className="text-5xl md:text-7xl lg:text-[90px] font-black tracking-[-0.05em] font-display mb-12 leading-[0.85]">Rejoignez la <br /> force de vente.</h3>
              <p className="text-lg lg:text-xl text-gray-400 mb-16 leading-relaxed font-medium">Nous recrutons des commerciaux terrain dynamiques pour porter la vision de LIPIDUS dans chaque quartier d'Abidjan.</p>
              <div className="bg-gray-800/50 p-10 lg:p-14 rounded-[40px] lg:rounded-[60px] border border-gray-700/50 backdrop-blur-sm">
                <p className="text-emerald-500 font-black text-4xl lg:text-6xl tracking-tighter mb-4 font-display">150 000f / mois</p>
                <p className="text-gray-500 font-black uppercase tracking-[0.2em] text-[10px]">Rémunération attractive selon performance</p>
              </div>
              <div className="mt-16">
                <div onClick={onRecruit} className="inline-flex items-center gap-6 cursor-pointer group">
                  <span className="text-xl lg:text-2xl font-black uppercase tracking-tighter text-emerald-500 border-b-4 border-emerald-500 pb-1 group-hover:text-emerald-400 group-hover:border-emerald-400 transition-all font-display">Postuler maintenant</span>
                  <div className="w-12 h-12 rounded-full border-2 border-emerald-500 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all"><ArrowRight className="w-6 h-6" /></div>
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
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 1 }}>
              <h2 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.5em] mb-10">PARTENAIRES LIPIDUS PRO (Tricycles)</h2>
              <h3 className="text-5xl md:text-7xl lg:text-[80px] font-black tracking-[-0.05em] font-display mb-12 leading-[0.85]">Gagnez en 2 jours ce que les autres gagnent en une semaine.</h3>
              
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
                <div onClick={onPartner} className="inline-flex items-center gap-6 cursor-pointer group">
                  <span className="text-xl lg:text-2xl font-black uppercase tracking-tighter text-emerald-600 border-b-4 border-emerald-600 pb-1 group-hover:text-emerald-700 group-hover:border-emerald-700 transition-all font-display">Devenir Partenaire Pro</span>
                  <div className="w-12 h-12 rounded-full border-2 border-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all"><ArrowRight className="w-6 h-6" /></div>
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 1 }} className="relative">
              <div className="aspect-square rounded-[40px] lg:rounded-[80px] overflow-hidden bg-gray-100 shadow-2xl group">
                {images.partner ? (
                  <img 
                    src={images.partner} 
                    alt="Partenaire professionnel LIPIDUS Pro pour la gestion des déchets d'entreprise" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                    referrerPolicy="no-referrer"
                  />
                ) : <ImageSkeleton />}
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
              <p className="text-gray-400 text-xl lg:text-2xl max-w-md mb-16 leading-relaxed font-medium">Leader de la collecte de proximité à Abidjan. Gardez les mains propre, on se sali pour vous.</p>
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
