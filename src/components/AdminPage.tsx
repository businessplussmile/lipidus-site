import React, { useState, useEffect, ChangeEvent } from 'react';
import { ArrowRight, AlertTriangle, RefreshCw, Upload } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, collection } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { handleFirestoreError } from '../utils/firestore';
import { OperationType } from '../types';

interface AdminPageProps {
  onBack: () => void;
}

export const AdminPage = ({ onBack }: AdminPageProps) => {
  const [password, setPassword] = useState('');
  const [isPasswordCorrect, setIsPasswordCorrect] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [images, setImages] = useState<{ [key: string]: string }>({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'settings'), (snapshot) => {
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
      if (file.size > 800000) {
        setError("L'image est trop volumineuse (max 800KB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
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
            <div onClick={onBack} className="cursor-pointer p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowRight className="w-6 h-6 rotate-180" /></div>
            <h2 className="text-2xl font-black font-display">Accès Restreint</h2>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Code d'accès</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full mt-2 p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 transition-all outline-none" placeholder="••••••••" />
            </div>
            {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
            <button type="submit" className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-black transition-colors">Valider</button>
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
            <div onClick={onBack} className="cursor-pointer p-3 bg-white shadow-sm hover:shadow-md rounded-2xl transition-all"><ArrowRight className="w-6 h-6 rotate-180" /></div>
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
                <button onClick={handleLogout} className="ml-4 text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors">Déconnexion</button>
              </div>
            ) : (
              <button onClick={handleGoogleLogin} className="flex items-center gap-3 px-6 py-3 bg-white border-2 border-gray-100 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm">
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />Connexion Google
              </button>
            )}
          </div>
        </div>

        {error && <div className="mb-8 p-6 bg-red-50 border border-red-100 rounded-3xl text-red-600 text-sm font-bold flex items-center gap-4"><AlertTriangle className="w-6 h-6" />{error}</div>}
        {isSaving && <div className="mb-8 p-6 bg-emerald-50 border border-emerald-100 rounded-3xl text-emerald-600 text-sm font-bold flex items-center gap-4 animate-pulse"><RefreshCw className="w-6 h-6 animate-spin" />Enregistrement...</div>}

        <div className="grid gap-8">
          {[
            { key: 'collector', title: 'Image Collecteur (Section Héros)', desc: 'Image principale en haut de la page' },
            { key: 'commercials', title: 'Image Commerciaux (Section Recrutement)', desc: 'Image de la force de vente' },
            { key: 'partner', title: 'Image Partenaire (Section Pro)', desc: 'Image du tricycle logistique' }
          ].map((zone) => (
            <div key={zone.key} className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8 items-center">
              <div className="w-full md:w-1/3 aspect-square bg-gray-100 rounded-3xl overflow-hidden relative">
                {images[zone.key] ? <img src={images[zone.key]} alt={zone.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold">Aucune image</div>}
              </div>
              <div className="flex-1 space-y-4">
                <h3 className="text-xl font-black font-display">{zone.title}</h3>
                <p className="text-gray-500 text-sm">{zone.desc}</p>
                <div className="pt-4">
                  <label className="cursor-pointer inline-flex items-center gap-3 px-6 py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-100 transition-colors">
                    <Upload className="w-4 h-4" />Modifier l'image
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(zone.key, e)} />
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
