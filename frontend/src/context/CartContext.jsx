import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    const saved = localStorage.getItem('hotel_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [restaurantSlug, setRestaurantSlug] = useState(() => {
    return localStorage.getItem('hotel_cart_slug') || 'grand-palace';
  });

  useEffect(() => {
    localStorage.setItem('hotel_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    if (restaurantSlug) {
      localStorage.setItem('hotel_cart_slug', restaurantSlug);
    }
  }, [restaurantSlug]);

  useEffect(() => {
    const handleCartCleared = () => {
      setCartItems([]);
    };
    window.addEventListener('cart_cleared', handleCartCleared);
    return () => window.removeEventListener('cart_cleared', handleCartCleared);
  }, []);

  const addToCart = (item, quantity = 1, instructions = '', itemSlug = null) => {
    setCartItems((prevItems) => {
      // If adding items from a different restaurant, clear previous items automatically
      const targetSlug = itemSlug || restaurantSlug;
      if (itemSlug && restaurantSlug && itemSlug !== restaurantSlug && prevItems.length > 0) {
        setRestaurantSlug(itemSlug);
        const unitPrice = item.discounted_price ? parseFloat(item.discounted_price) : parseFloat(item.price);
        return [
          {
            id: item.id,
            name: item.name,
            price: unitPrice,
            originalPrice: parseFloat(item.price),
            image_url: item.image_url,
            is_veg: item.is_veg,
            quantity,
            specialInstructions: instructions
          }
        ];
      }

      if (itemSlug) {
        setRestaurantSlug(itemSlug);
      }

      const existingIndex = prevItems.findIndex((i) => i.id === item.id);
      if (existingIndex > -1) {
        const updated = [...prevItems];
        updated[existingIndex].quantity += quantity;
        if (instructions) {
          updated[existingIndex].specialInstructions = instructions;
        }
        return updated;
      } else {
        const unitPrice = item.discounted_price ? parseFloat(item.discounted_price) : parseFloat(item.price);
        return [
          ...prevItems,
          {
            id: item.id,
            name: item.name,
            price: unitPrice,
            originalPrice: parseFloat(item.price),
            image_url: item.image_url,
            is_veg: item.is_veg,
            quantity,
            specialInstructions: instructions
          }
        ];
      }
    });
  };

  const updateQuantity = (itemId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity: newQty } : item))
    );
  };

  const removeFromCart = (itemId) => {
    setCartItems((prev) => {
      const updated = prev.filter((item) => item.id !== itemId);
      if (updated.length === 0) {
        localStorage.removeItem('hotel_cart');
      }
      return updated;
    });
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem('hotel_cart');
    localStorage.removeItem('hotel_cart_slug');
  };

  const getSubtotal = () => {
    return cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  };

  const getItemCount = () => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        restaurantSlug,
        setRestaurantSlug,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        getSubtotal,
        getItemCount
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
