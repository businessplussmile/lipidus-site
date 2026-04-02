import React, { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
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
