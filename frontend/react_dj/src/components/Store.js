import React, { useState, useContext, useEffect } from 'react';
import { UserContext } from '../contexts/UserContext';
import { Coins, Check, X, Tag, Music, Sparkles, AlertCircle, Headphones } from 'lucide-react';
import axios from 'axios';
import '../styles/Store.css';
import { API_URL } from '../config';

const Store = () => {
  const { user, updateCoins, token } = useContext(UserContext);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);

  useEffect(() => {
    const fetchUserCoins = async () => {
      if (user && token) {
        try {
          const response = await axios.get(`${API_URL}/api/payments/get-user-coins`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.data && response.data.coins !== undefined) {
            updateCoins(response.data.coins);
          }
        } catch (error) {
          console.error('Error fetching user coins:', error);
        }
      }
    };
    
    fetchUserCoins();
  }, [user?.username, token]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSuccessMessage('');
      setErrorMessage('');
    }, 5000);

    return () => clearTimeout(timer);
  }, [successMessage, errorMessage]);

  // Check URL parameters for success or canceled payment
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const coins = urlParams.get('coins');

    if (success) {
      setSuccessMessage(`Payment successful! ${coins} coins have been added to your account.`);
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (canceled) {
      setErrorMessage('Payment canceled. No coins were added to your account.');
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const coinPackages = [
    { 
      id: 'basic', 
      coins: 100, 
      price: '4.99',
      name: 'Starter Pack',
      icon: <Music size={20} />,
      description: 'Perfect for beginners'
    },
    { 
      id: 'standard', 
      coins: 500, 
      price: '19.99',
      name: 'Melody Pack',
      icon: <Headphones size={20} />,
      description: 'For regular DJs and listeners'
    },
    { 
      id: 'premium', 
      coins: 1000, 
      price: '34.99',
      name: 'Harmony Pack',
      icon: <Sparkles size={20} />,
      description: 'For serious DJs and musicians'
    },
    { 
      id: 'ultimate', 
      coins: 2500, 
      price: '79.99',
      name: 'Symphony Pack',
      icon: <Coins size={20} />,
      description: 'For professional DJs and musicians'
    }
  ];

  const handleCouponApply = () => {
    if (couponCode.trim().toUpperCase() === 'AICOFREE') {
      // Set a reasonable discount - the actual discount will be calculated on the server
      // based on Stripe's minimum transaction amount
      setCouponApplied(true);
      setDiscountAmount(90);
      setSuccessMessage('Coupon AICOFREE applied! Up to 90% discount on your purchase.');
    } else {
      setCouponApplied(false);
      setDiscountAmount(0);
      setErrorMessage('Invalid coupon code.');
    }
  };

  const handlePurchase = async (packageId) => {
    if (!user) {
      setErrorMessage('You need to be logged in to purchase coins.');
      return;
    }

    setLoading(true);
    const selectedPackage = coinPackages.find(pkg => pkg.id === packageId);
    
    try {
      const response = await axios.post(`${API_URL}/api/payments/create-checkout`, {
        packageId: selectedPackage.id,
        coins: selectedPackage.coins,
        price: selectedPackage.price,
        couponCode: couponApplied ? couponCode.trim().toUpperCase() : ''
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data && response.data.url) {
        window.location.href = response.data.url;
      } else {
        setErrorMessage('Failed to create checkout session.');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setErrorMessage('Failed to create checkout session. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const calculateDiscountedPrice = (price) => {
    if (!couponApplied) return price;
    
    // Calculate an estimated discounted price
    // The actual discount is calculated on the server based on Stripe's minimum amount
    const priceFloat = parseFloat(price);
    const minPrice = 0.50; // Stripe's minimum is $0.50
    
    // Calculate maximum possible discount that would still result in at least $0.50
    const maxDiscountPercent = Math.min(90, ((priceFloat - minPrice) / priceFloat * 100));
    
    // Use the lower of our estimated discount or the calculated maximum
    const effectiveDiscount = Math.min(discountAmount, maxDiscountPercent);
    
    // Apply the discount
    const discountedPrice = Math.max(minPrice, priceFloat * (100 - effectiveDiscount) / 100).toFixed(2);
    return discountedPrice;
  };

  return (
    <div className="store-container">
      <h1>Aico Coins Store</h1>
      
      {user && (
        <div className="current-balance">
          <Coins size={24} />
          <span>Current Balance: {user.coins || 0} coins</span>
        </div>
      )}
      
      {successMessage && (
        <div className="success-message">
          <Check size={20} />
          <span>{successMessage}</span>
        </div>
      )}
      
      {errorMessage && (
        <div className="error-message">
          <AlertCircle size={20} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="coupon-section">
        <h3>Have a Coupon?</h3>
        <p>Enter your code below to get a discount on your purchase.</p>
        <div className="coupon-input-container">
          <input
            type="text"
            placeholder="Enter coupon code"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            className="coupon-input"
          />
          <button 
            onClick={handleCouponApply}
            className="coupon-button"
            disabled={loading || !couponCode.trim()}
          >
            <Tag size={16} className="coupon-icon" />
            Apply
          </button>
        </div>
        {couponApplied && (
          <div className="coupon-applied">
            <Check size={16} />
            <span>Discount applied! Final price shown below.</span>
          </div>
        )}
      </div>
      
      <div className="coin-packages">
        <h2>Select a Coin Package</h2>
        <div className="packages-grid">
          {coinPackages.map(pkg => (
            <div key={pkg.id} className="package-card">
              <div className="package-content">
                <div className="package-name">
                  {pkg.icon}
                  <h3>{pkg.name}</h3>
                </div>
                <div className="coin-amount">
                  <Coins size={24} />
                  <span>{pkg.coins} coins</span>
                </div>
                <p className="package-description">{pkg.description}</p>
                <div className="package-price">
                  {couponApplied && (
                    <span className="original-price">${pkg.price}</span>
                  )}
                  <span className={couponApplied ? "discounted-price" : ""}>
                    ${calculateDiscountedPrice(pkg.price)}
                  </span>
                </div>
                <button 
                  onClick={() => handlePurchase(pkg.id)} 
                  className="purchase-button"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Purchase Now'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="store-footer">
        <p>Aico Coins are used to access premium features in our AI music platform.</p>
        <p>Need help? Contact our support team at support@aicomusic.com</p>
      </div>
    </div>
  );
};

export default Store;
