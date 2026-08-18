import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('hotel_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [restaurant, setRestaurant] = useState(() => {
    const savedRest = localStorage.getItem('hotel_admin_restaurant');
    return savedRest ? JSON.parse(savedRest) : null;
  });
  const [restaurants, setRestaurants] = useState([]);
  const [guestInfo, setGuestInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize guest identity on mount (for customers, no login needed)
  useEffect(() => {
    api.post('/guest/init')
      .then(res => {
        if (res.data.success) {
          setGuestInfo(res.data.guest);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('hotel_token');
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          if (res.data.success) {
            setUser(res.data.user);
            localStorage.setItem('hotel_user', JSON.stringify(res.data.user));
            if (res.data.restaurant) {
              setRestaurant(res.data.restaurant);
              localStorage.setItem('hotel_admin_restaurant', JSON.stringify(res.data.restaurant));
            }
            if (res.data.restaurants) {
              setRestaurants(res.data.restaurants);
            }
          }
        })
        .catch(() => {
          setUser(null);
          setRestaurant(null);
          localStorage.removeItem('hotel_token');
          localStorage.removeItem('hotel_user');
          localStorage.removeItem('hotel_admin_restaurant');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.success) {
      localStorage.setItem('hotel_token', res.data.token);
      localStorage.setItem('hotel_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      if (res.data.restaurant) {
        setRestaurant(res.data.restaurant);
        localStorage.setItem('hotel_admin_restaurant', JSON.stringify(res.data.restaurant));
      }
      if (res.data.restaurants) {
        setRestaurants(res.data.restaurants);
      }
    }
    return res.data;
  };

  const register = async (name, email, password, phone, role = 'CUSTOMER') => {
    const res = await api.post('/auth/register', { name, email, password, phone, role });
    if (res.data.success) {
      localStorage.setItem('hotel_token', res.data.token);
      localStorage.setItem('hotel_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
    }
    return res.data;
  };

  const registerRestaurant = async (payload) => {
    const res = await api.post('/auth/register-restaurant', payload);
    if (res.data.success) {
      localStorage.setItem('hotel_token', res.data.token);
      localStorage.setItem('hotel_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      if (res.data.restaurant) {
        setRestaurant(res.data.restaurant);
        localStorage.setItem('hotel_admin_restaurant', JSON.stringify(res.data.restaurant));
      }
    }
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('hotel_token');
    localStorage.removeItem('hotel_user');
    localStorage.removeItem('hotel_admin_restaurant');
    localStorage.removeItem('hotel_cart');
    localStorage.removeItem('hotel_cart_slug');
    setUser(null);
    setRestaurant(null);
    setRestaurants([]);
    window.dispatchEvent(new Event('cart_cleared'));
  };

  return (
    <AuthContext.Provider value={{
      user, restaurant, restaurants, guestInfo,
      setRestaurant, loading,
      login, register, registerRestaurant, logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
