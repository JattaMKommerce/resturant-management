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
  // REQ-029: what this user may do in the admin area (owners: everything)
  const [access, setAccess] = useState({ owner: false, permissions: [], loaded: false });
  const loadAccess = () => {
    if (!localStorage.getItem('hotel_token')) return;
    api.get('/auth/permissions')
      .then((res) => setAccess({ owner: Boolean(res.data.owner), permissions: res.data.permissions || [], loaded: true }))
      .catch(() => setAccess((a) => ({ ...a, loaded: true })));
  };
  const can = (key) => access.owner || access.permissions.includes(key);
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
            loadAccess();
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
    if (res.data && res.data.success) {
      const data = res.data.data || res.data;
      const token = res.data.token || data.token;
      const user = res.data.user || data.user;
      const restaurant = res.data.restaurant || data.restaurant;
      const restaurants = res.data.restaurants || data.restaurants;

      if (token) localStorage.setItem('hotel_token', token);
      if (user) {
        localStorage.setItem('hotel_user', JSON.stringify(user));
        setUser(user);
      }
      if (restaurant) {
        setRestaurant(restaurant);
        localStorage.setItem('hotel_admin_restaurant', JSON.stringify(restaurant));
      }
      if (restaurants) {
        setRestaurants(restaurants);
      }
      if (!res.data.password_change_required) loadAccess();
      return {
        ...res.data,
        token,
        user,
        restaurant,
        restaurants
      };
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

  const updateRestaurant = (updatedData) => {
    setRestaurant(prev => {
      const merged = { ...(prev || {}), ...updatedData };
      localStorage.setItem('hotel_admin_restaurant', JSON.stringify(merged));
      return merged;
    });
  };

  const updateSuiteMode = (mode) => {
    localStorage.setItem('hotel_product_mode', mode);
    setUser(prev => {
      const updated = { ...(prev || {}), suite_mode: mode };
      localStorage.setItem('hotel_user', JSON.stringify(updated));
      return updated;
    });
  };

  // Drop the signed-in state in this tab (no server call).
  const clearSession = (reason) => {
    localStorage.removeItem('hotel_token');
    localStorage.removeItem('hotel_user');
    localStorage.removeItem('hotel_admin_restaurant');
    localStorage.removeItem('hotel_cart');
    localStorage.removeItem('hotel_cart_slug');
    localStorage.removeItem('hotel_last_activity');
    if (reason) {
      try { sessionStorage.setItem('hotel_logout_reason', reason); } catch (e) {}
    }
    setUser(null);
    setRestaurant(null);
    setRestaurants([]);
    setAccess({ owner: false, permissions: [], loaded: false });
    window.dispatchEvent(new Event('cart_cleared'));
  };

  // Log out: end the session on the server (so the token and its cookie copy stop working
  // everywhere, REQ-012), then clear this browser. Other open tabs follow via the storage event.
  const logout = (reason) => {
    const token = localStorage.getItem('hotel_token');
    if (token) {
      api.post('/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    clearSession(typeof reason === 'string' ? reason : undefined);
  };

  // Keep every tab and the Back button honest (REQ-013):
  //  - logging out in another tab logs this tab out too;
  //  - a page restored from the browser's back/forward cache re-checks the session;
  //  - a 401 from the server (logged out, password changed, account deactivated) ends the session here.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'hotel_token' && !e.newValue) clearSession();
    };
    const onPageShow = (e) => {
      if (e.persisted && !localStorage.getItem('hotel_token')) clearSession();
    };
    const onSessionEnded = (e) => {
      clearSession(e?.detail?.message || 'Your session has ended. Please log in again.');
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('hms_session_ended', onSessionEnded);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('hms_session_ended', onSessionEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{
      user, setUser, restaurant, setRestaurant, restaurants, setRestaurants, guestInfo, setGuestInfo,
      updateRestaurant, updateSuiteMode, loading, access, can, loadAccess,
      login, register, registerRestaurant, logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
