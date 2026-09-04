const pool = require('../../config/database');
const { sendSuccess, sendError } = require('../../utils/response');

let hotelsSchemaVerified = false;

// 20 Varied & Meaningful Hotel Records
const INITIAL_20_HOTELS = [
  {
    name: 'The Grand Palace Heritage & Spa',
    category: 'Heritage Hotel',
    location: 'No. 42, M.G. Road, Central District',
    city: 'Bengaluru',
    rating: 4.9,
    price_per_night: 9500.00,
    description: 'A magnificent 19th-century royal palace restored into a palatial luxury sanctuary with hand-carved pillars, sprawling courtyards, an Ayurvedic wellness spa, and fine dining.',
    main_image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['Royal Spa & Wellness', 'Infinity Palace Pool', '24/7 Butler Service', 'Valet Parking', 'Free High-Speed WiFi', 'Michelin-Inspired Dining', 'Banquet Ballroom', 'Airport Limousine']),
    breakfast_info: 'Complimentary Royal Buffet Breakfast Included',
    breakfast_included: 1,
    breakfast_price: 0.00,
    check_in_time: '14:00',
    check_out_time: '12:00',
    total_rooms: 85,
    room_types: JSON.stringify(['Heritage Suite', 'Maharaja Presidential Suite', 'Royal Courtyard Room', 'Palace Deluxe Room']),
    policies: 'Cancellation free up to 48 hours prior. Valid Photo ID required. Pet-friendly suites available upon advance request.'
  },
  {
    name: 'Azure Bay Luxury Beach Resort',
    category: 'Beach Resort',
    location: 'Candolim Beachfront, North Goa',
    city: 'Goa',
    rating: 4.8,
    price_per_night: 12000.00,
    description: 'Breathtaking oceanfront resort with private white-sand beach access, overwater sunset bungalows, beachside cabanas, infinity pool, and water sports center.',
    main_image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['Private Beach Access', 'Oceanfront Infinity Pool', 'Beachside Bar & Grill', 'Snorkeling & Scuba Gear', 'Ayurvedic Spa', 'Kids Adventure Club', 'Sunset Yacht Charters']),
    breakfast_info: 'Complimentary Tropical Ocean-View Breakfast Buffet Included',
    breakfast_included: 1,
    breakfast_price: 0.00,
    check_in_time: '15:00',
    check_out_time: '11:00',
    total_rooms: 60,
    room_types: JSON.stringify(['Oceanfront Villa', 'Beach Cabana Suite', 'Sunset Deluxe Room', 'Family Beach House']),
    policies: '100% smoke-free property. Free cancellation up to 72 hours. All major credit cards accepted.'
  },
  {
    name: 'The Metropolitan Business Hotel',
    category: 'Business Hotel',
    location: 'Bandra Kurla Complex (BKC)',
    city: 'Mumbai',
    rating: 4.7,
    price_per_night: 6500.00,
    description: 'Premier business hotel located in the heart of Mumbai\'s financial epicenter. Features ergonomic work suites, high-tech conference pods, express dry cleaning, and rooftop lounge.',
    main_image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['24/7 Business Center', 'High-Speed Fiber WiFi (1 Gbps)', 'Executive Boardrooms', 'Rooftop Cocktail Bar', 'Fitness Club & Steam Room', 'Airport Chauffeur', 'Express Laundry']),
    breakfast_info: 'International Executive Breakfast Buffet Available (₹650 extra)',
    breakfast_included: 0,
    breakfast_price: 650.00,
    check_in_time: '12:00',
    check_out_time: '12:00',
    total_rooms: 120,
    room_types: JSON.stringify(['Executive Business Room', 'Corporate Club Suite', 'Standard Work Pod', 'Presidential Corner Suite']),
    policies: 'Corporate ID or Business Card required. Free cancellation up to 24 hours.'
  },
  {
    name: 'Serene Valley Mountain Chalet & Spa',
    category: 'Mountain Resort',
    location: 'Old Manali Ridge, Log Huts Area',
    city: 'Manali',
    rating: 4.9,
    price_per_night: 8200.00,
    description: 'Idyllic Himalayan mountain retreat built with pine and local river stone. Offers panoramic snow-capped peak views, heated indoor cedar pools, and crackling wood fireplaces.',
    main_image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['Wood-Burning Fireplaces', 'Heated Indoor Pool', 'Mountain View Balconies', 'Himalayan Herbal Spa', 'Guided Trekking', 'Stargazing Observatory Deck', 'Bonfire Dinners']),
    breakfast_info: 'Complimentary Alpine Gourmet Breakfast with Local Fruit Preserves Included',
    breakfast_included: 1,
    breakfast_price: 0.00,
    check_in_time: '13:00',
    check_out_time: '11:00',
    total_rooms: 40,
    room_types: JSON.stringify(['Chalet Pine Suite', 'Himalayan View Attic', 'Cedar Wood Deluxe', 'Honeymoon Loft']),
    policies: 'Heater charges included in tariff. Children under 6 stay free.'
  },
  {
    name: 'Urban Oasis Boutique Suites',
    category: 'Boutique Hotel',
    location: 'Hauz Khas Village, South Delhi',
    city: 'New Delhi',
    rating: 4.6,
    price_per_night: 5800.00,
    description: 'Chic designer boutique hotel infused with contemporary art installations, custom brass fixtures, artisan espresso bars, and a leafy rooftop hydroponic garden.',
    main_image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['Artisan Espresso Bar', 'Curated Art Gallery', 'Rooftop Hydroponic Garden', 'Bespoke Bath Amenities', 'High-Speed WiFi', 'Bicycle Rentals', 'Pet Friendly']),
    breakfast_info: 'Complimentary Artisanal Breakfast Included (Farm-to-table eggs, sourdough, and cold pressed juices)',
    breakfast_included: 1,
    breakfast_price: 0.00,
    check_in_time: '14:00',
    check_out_time: '12:00',
    total_rooms: 35,
    room_types: JSON.stringify(['Studio Loft', 'Terrace Garden Suite', 'Artisan King Room', 'Boho Chic Double']),
    policies: 'Eco-conscious zero single-use plastic property. Quiet hours after 22:00.'
  },
  {
    name: 'Skyline Aero Airport Transit Hotel',
    category: 'Airport Hotel',
    location: 'Aerocity Hospitality District, IGI Airport',
    city: 'New Delhi',
    rating: 4.5,
    price_per_night: 4200.00,
    description: 'Designed for global jet-setters and transit travelers. Featuring soundproof sleep suites, 24-hour terminal shuttles, express check-in kiosks, and round-the-clock dining.',
    main_image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['Free Airport Shuttle (24/7)', 'Acoustic Soundproofing', 'Flight Status Screens in Lobby', '24-Hour Fitness Gym', 'Express 30-Min Laundry', 'Grab & Go Café']),
    breakfast_info: '24-Hour International Transit Buffet Available (₹400 extra)',
    breakfast_included: 0,
    breakfast_price: 400.00,
    check_in_time: '12:00',
    check_out_time: '12:00',
    total_rooms: 150,
    room_types: JSON.stringify(['Transit Pod', 'Soundproof Executive Room', 'Runway View Deluxe', 'Day-Use Transit Cabin']),
    policies: 'Flexible 6-hour, 12-hour and 24-hour transit stays available. Boarding pass required for transit rates.'
  },
  {
    name: 'Palm Grove Family Holiday Resort',
    category: 'Family Resort',
    location: 'Vembanad Lake Shore, Kumarakom',
    city: 'Kerala',
    rating: 4.8,
    price_per_night: 7900.00,
    description: 'Picturesque backwaters family retreat with private pool villas, coconut grove pathways, houseboat day trips, kids fun water park, and traditional Kerala cultural shows.',
    main_image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['Lagoon Pool & Kids Waterpark', 'Houseboat Cruises', 'Ayurvedic Spa & Yoga Shala', 'Fishing Deck & Kayaking', 'Pottery & Cooking Classes', 'Family Game Arcade']),
    breakfast_info: 'Complimentary Traditional Kerala & Continental Breakfast Included (Appam, Stew & Dosa Stations)',
    breakfast_included: 1,
    breakfast_price: 0.00,
    check_in_time: '14:00',
    check_out_time: '11:00',
    total_rooms: 45,
    room_types: JSON.stringify(['Waterfront Family Villa', 'Pool Pavilion Cottage', 'Lakeview Deluxe Suite', 'Heritage Backwater Room']),
    policies: 'Complimentary stay for 2 children below 10 years. Lifejackets provided for all water activities.'
  },
  {
    name: 'Elysium Luxury Residences & Suites',
    category: 'Luxury Hotel',
    location: 'Banjara Hills, Road No. 1',
    city: 'Hyderabad',
    rating: 5.0,
    price_per_night: 14500.00,
    description: 'Ultra-exclusive 5-star residence with panoramic city skyline views, private plunge pools, dedicated butler service, Michelin-caliber gastronomy, and luxury chauffeur fleet.',
    main_image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['Private Plunge Pools', 'Dedicated Butler Service', 'Rooftop Helipad', 'Michelin Star Chef Dining', 'Chauffeured Rolls Royce', 'Private Wine Cellar', 'Luxury Spa Suites']),
    breakfast_info: 'Complimentary Gourmet Champagne Breakfast Included (Caviar, Truffle Omelets & Artisanal Pastries)',
    breakfast_included: 1,
    breakfast_price: 0.00,
    check_in_time: '14:00',
    check_out_time: '13:00',
    total_rooms: 50,
    room_types: JSON.stringify(['Presidential Penthouse', 'Diplomatic Suite', 'Sky View Residence', 'Elysium Grand Room']),
    policies: 'Strict guest privacy protocols. 24/7 security concierge. Valet-only parking.'
  },
  {
    name: 'The Nomad Eco-Lodge & Glamping',
    category: 'Boutique Hotel',
    location: 'Madikeri Coffee Plantation',
    city: 'Coorg',
    rating: 4.7,
    price_per_night: 6100.00,
    description: 'Sustainable luxury glamping and wooden treehouses nestled amidst 200 acres of organic Arabica coffee groves, birdsong, and mist-laden waterfalls.',
    main_image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['Organic Coffee Plantation Tours', 'Treehouse Suites', 'Natural Stream Bathing', 'Campfire & Barbecue', 'Bird Watching Trails', 'Solar Powered & Eco-Certified']),
    breakfast_info: 'Complimentary Organic Farm-to-Table Breakfast Included with Fresh Estate Coffee',
    breakfast_included: 1,
    breakfast_price: 0.00,
    check_in_time: '13:00',
    check_out_time: '11:00',
    total_rooms: 25,
    room_types: JSON.stringify(['Canopy Treehouse', 'Luxury Safari Tent', 'Plantation Cottage', 'Eco Wooden Cabin']),
    policies: 'Zero single-use plastic. Guided estate walks included. Smoking prohibited in plantation areas.'
  },
  {
    name: 'Royal Rajputana Haveli',
    category: 'Heritage Hotel',
    location: 'Old City, Amber Fort Road',
    city: 'Jaipur',
    rating: 4.9,
    price_per_night: 11000.00,
    description: 'Authentic 200-year-old sandstone haveli adorned with frescoed arches, royal jharokhas, marble fountains, puppet theater, and rooftop banquets with views of Nahargarh Fort.',
    main_image: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['Frescoed Marble Courtyards', 'Rooftop Fort-View Dining', 'Live Folk Dance & Sitar', 'Traditional Royal Spa', 'Vintage Car City Tours', 'Heritage Library']),
    breakfast_info: 'Complimentary Royal Rajasthani & Continental Breakfast Included (Fresh Kachoris, Jalebi & Parathas)',
    breakfast_included: 1,
    breakfast_price: 0.00,
    check_in_time: '14:00',
    check_out_time: '12:00',
    total_rooms: 42,
    room_types: JSON.stringify(['Royal Haveli Suite', 'Maharani Balcony Room', 'Sandstone Heritage Room', 'Jharokha Deluxe Suite']),
    policies: 'Traditional floral welcome and tikka on arrival. Alcohol served only in licensed dining venues.'
  },
  {
    name: 'Citadel Express City Center Hotel',
    category: 'Budget Hotel',
    location: 'Mount Road, Near Central Station',
    city: 'Chennai',
    rating: 4.3,
    price_per_night: 2200.00,
    description: 'Smart, spotless, modern economy hotel geared towards budget travelers and weekend city visitors. Features pocket-friendly rates, orthopedic mattresses, and fast subway access.',
    main_image: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['High-Speed WiFi', '24/7 Front Desk', 'Keyless Digital Entry', 'Daily Housekeeping', 'Elevator Access', 'Luggage Storage Locker', 'Subway 2-Min Walk']),
    breakfast_info: 'South Indian Breakfast Box Available (₹250 extra)',
    breakfast_included: 0,
    breakfast_price: 250.00,
    check_in_time: '12:00',
    check_out_time: '11:00',
    total_rooms: 80,
    room_types: JSON.stringify(['Express Queen Room', 'Standard Twin Pod', 'Compact City Double', 'Solo Traveler Pod']),
    policies: 'Pre-payment required at check-in. 24-hour CCTV monitoring across all corridors.'
  },
  {
    name: 'The Highline Tech City Hotel',
    category: 'Business Hotel',
    location: 'HITEC City, Phase 2',
    city: 'Hyderabad',
    rating: 4.6,
    price_per_night: 5400.00,
    description: 'Futuristic business smart-hotel with AI voice-controlled rooms, motorized blackout blinds, multi-device charging desks, 24/7 fitness arena, and rooftop craft brewery.',
    main_image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['AI Voice Automation in Rooms', 'High-Speed Mesh WiFi (500 Mbps)', '24/7 Tech Fitness Hub', 'Rooftop Craft Brewery', 'Ergonomic Herman Miller Desks', 'EV Charging Station']),
    breakfast_info: 'Complimentary Smart Tech Express Breakfast Buffet Included',
    breakfast_included: 1,
    breakfast_price: 0.00,
    check_in_time: '13:00',
    check_out_time: '12:00',
    total_rooms: 110,
    room_types: JSON.stringify(['Tech Studio Room', 'Silicon Executive Suite', 'Corner Smart King', 'Developer Workpod Suite']),
    policies: 'Digital check-in via mobile key supported. Corporate discounts applicable.'
  },
  {
    name: 'Coral Reef Oceanfront Suites',
    category: 'Beach Resort',
    location: 'Radhanagar Beach, Havelock Island',
    city: 'Andaman & Nicobar',
    rating: 4.9,
    price_per_night: 16000.00,
    description: 'Paradise island escape situated directly on crystal-clear turquoise waters. Overwater villas, coral reef snorkeling from private decks, and candlelight seafood barbecue under the stars.',
    main_image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['Overwater Bungalow Decks', 'PADI Certified Dive Center', 'Coral Snorkeling Trails', 'Sunset Seafood Grill', 'Island Catamaran Trips', 'Ocean Breeze Spa']),
    breakfast_info: 'Complimentary Island Gourmet Breakfast Included (Tropical Fruit, Bakeries & Coconut Water)',
    breakfast_included: 1,
    breakfast_price: 0.00,
    check_in_time: '14:00',
    check_out_time: '10:30',
    total_rooms: 30,
    room_types: JSON.stringify(['Overwater Coral Villa', 'Beachfront Honeymoon Suite', 'Oceanview Lagoon Cottage', 'Island Master Villa']),
    policies: 'Eco-sensitive zone: reef-safe sunscreen mandatory. Ferry transfer assistance provided.'
  },
  {
    name: 'Mist & Pines Hilltop Manor',
    category: 'Mountain Resort',
    location: 'Dodabetta Peak Road',
    city: 'Ooty',
    rating: 4.8,
    price_per_night: 7500.00,
    description: 'Colonial British tea estate manor nestled amid rolling blue Nilgiri hills. Offers antique mahogany 4-poster beds, high tea on the lawn, and mist-wrapped forest views.',
    main_image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['Tea Tasting Tours', 'Colonial Lawn High Tea', 'Mahogany Wood Fireplaces', 'Billiard & Snooker Room', 'Horseback Trail Riding', 'Heated Bedding']),
    breakfast_info: 'Complimentary Traditional English Breakfast Included (Scones, Clotted Cream & Single-Estate Tea)',
    breakfast_included: 1,
    breakfast_price: 0.00,
    check_in_time: '13:00',
    check_out_time: '11:00',
    total_rooms: 32,
    room_types: JSON.stringify(['Lord Mountbatten Suite', 'Tea Garden Cottage', 'Nilgiri Panorama Room', 'Fireplace Attic Room']),
    policies: 'Formal dress recommended for evening manor dinner. Non-smoking interior.'
  },
  {
    name: 'Velvet Orchid Lifestyle Hotel',
    category: 'Boutique Hotel',
    location: 'Park Street Entertainment Hub',
    city: 'Kolkata',
    rating: 4.5,
    price_per_night: 4900.00,
    description: 'Vibrant boutique hotel celebrating Kolkata\'s jazz, literary, and culinary heritage. Features vinyl listening booths, mood lighting, and a speakeasy cocktail bar.',
    main_image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['Vinyl Record Listening Lounge', 'Speakeasy Craft Cocktail Bar', 'Artisan Bakery', 'Custom Mood Lighting', 'Rainfall Showers', 'High-Speed WiFi']),
    breakfast_info: 'Artisanal A La Carte Breakfast Available (₹450 extra)',
    breakfast_included: 0,
    breakfast_price: 450.00,
    check_in_time: '14:00',
    check_out_time: '12:00',
    total_rooms: 48,
    room_types: JSON.stringify(['Velvet Deluxe Room', 'Jazz Studio Suite', 'Park Street Corner Loft', 'Bohemian Penthouse']),
    policies: 'Age 18+ for speakeasy bar entry. Live music performances on weekends.'
  },
  {
    name: 'Lakeside Haven Wellness Retreat',
    category: 'Family Resort',
    location: 'Lake Pichola Shoreline',
    city: 'Udaipur',
    rating: 4.9,
    price_per_night: 13200.00,
    description: 'Holistic wellness sanctuary overlooking the shimmering waters of Lake Pichola. Dedicated to rejuvenation, organic gastronomy, sound bath healing, and private sunrise yoga sessions.',
    main_image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['Ayurvedic Doctor Consultation', 'Sunrise Lake Yoga Shala', 'Sound Healing Pavilion', 'Hydrotherapy Pools', 'Organic Farm-to-Table Dining', 'Lake Boat Transfers']),
    breakfast_info: 'Complimentary Ayurvedic Detox & Organic Superfood Breakfast Included',
    breakfast_included: 1,
    breakfast_price: 0.00,
    check_in_time: '14:00',
    check_out_time: '12:00',
    total_rooms: 38,
    room_types: JSON.stringify(['Lake Palace Pavilion', 'Lotus Wellness Suite', 'Sunrise Balcony Villa', 'Tranquility Garden Room']),
    policies: 'Mindful retreat atmosphere. Alcohol-free & vegetarian dining exclusively.'
  },
  {
    name: 'Apex International Hub Hotel',
    category: 'Airport Hotel',
    location: 'Kempegowda International Airport Link',
    city: 'Bengaluru',
    rating: 4.6,
    price_per_night: 4800.00,
    description: 'Connected via covered pedestrian skywalk to Terminal 1 & 2. High-speed check-in, soundproof glazing, day-use rooms, dynamic boarding flight monitors, and rooftop runway bar.',
    main_image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['Direct Skywalk to Airport Terminal', 'Soundproof Triple Glazing', 'Live Flight Status Terminals', '24/7 Global Buffet', 'Baggage Weighing & Wrapping', 'Express Gym & Sauna']),
    breakfast_info: 'Complimentary 24/7 Grab & Go and Hot Buffet Breakfast Included',
    breakfast_included: 1,
    breakfast_price: 0.00,
    check_in_time: '12:00',
    check_out_time: '12:00',
    total_rooms: 135,
    room_types: JSON.stringify(['Skywalk Executive King', 'Aero Transit Double', 'Soundproof Club Suite', 'Runway View Corner Suite']),
    policies: 'Day room bookings (4h, 8h) accepted at front desk. Boarding pass discount eligible.'
  },
  {
    name: 'The Silicon Suites Hotel',
    category: 'Business Hotel',
    location: 'Electronic City, Phase 1',
    city: 'Bengaluru',
    rating: 4.4,
    price_per_night: 3800.00,
    description: 'Corporate long-stay and business hotel equipped with kitchenettes, standing desks, high-speed wired internet, laundromat, and rooftop swimming pool with IT corridor views.',
    main_image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['In-Room Kitchenettes', 'Standing Work Desks & Dual Monitors', 'Self-Service Laundromat', 'Rooftop Swimming Pool', 'High-Speed Wi-Fi', 'Conference Facilities']),
    breakfast_info: 'Hot Indian & Continental Buffet Breakfast Available (₹350 extra)',
    breakfast_included: 0,
    breakfast_price: 350.00,
    check_in_time: '13:00',
    check_out_time: '12:00',
    total_rooms: 90,
    room_types: JSON.stringify(['Long-Stay Studio Suite', 'Executive 1-BHK Residence', 'Corporate Deluxe Room', 'Standard Studio Pod']),
    policies: 'Weekly and monthly corporate tariff packages available.'
  },
  {
    name: 'Breeze Haven Budget Inn',
    category: 'Budget Hotel',
    location: 'FC Road, Shivaji Nagar',
    city: 'Pune',
    rating: 4.2,
    price_per_night: 1800.00,
    description: 'Clean, reliable, no-frills budget stay situated near top universities and street food hubs. Features air-conditioned rooms, clean private bathrooms, and friendly service.',
    main_image: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['Air Conditioning', 'Free High-Speed Wi-Fi', 'Private Attached Bathroom', 'Filtered RO Drinking Water', '24/7 Reception', 'CCTV Security']),
    breakfast_info: 'Hot Maharashtrian Breakfast (Poha / Upma & Chai) Available (₹180 extra)',
    breakfast_included: 0,
    breakfast_price: 180.00,
    check_in_time: '12:00',
    check_out_time: '11:00',
    total_rooms: 40,
    room_types: JSON.stringify(['Standard AC Double Room', 'Economy Single AC Room', 'Deluxe Triple Bed Room']),
    policies: 'Valid Govt Photo ID mandatory. Unmarried couples welcome with valid adult IDs.'
  },
  {
    name: 'Imperial Grand Towers',
    category: 'Luxury Hotel',
    location: 'Chowringhee Road, Central Heritage Zone',
    city: 'Kolkata',
    rating: 4.8,
    price_per_night: 10500.00,
    description: 'Legendary 5-star landmark established in 1911. Boasts Austrian crystal chandeliers, white-glove service, a grand ballroom, private heritage cigar lounge, and temperature-controlled pool.',
    main_image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    gallery_images: JSON.stringify([
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=800&q=80'
    ]),
    amenities: JSON.stringify(['Austrian Crystal Ballroom', 'Temperature Controlled Pool', 'Heritage Cigar & Cognac Lounge', 'White-Glove Butler Service', 'Grand Piano Lounge', 'Valet Parking', 'Imperial High Tea']),
    breakfast_info: 'Complimentary Grand Continental & Heritage Buffet Breakfast Included',
    breakfast_included: 1,
    breakfast_price: 0.00,
    check_in_time: '14:00',
    check_out_time: '12:00',
    total_rooms: 115,
    room_types: JSON.stringify(['Viceroy Royal Suite', 'Imperial Grand Deluxe', 'Heritage Tower Suite', 'Classic Colonial Room']),
    policies: 'Smart casual dress code in lobby and fine dining restaurants after 18:00.'
  }
];

async function ensureHotelsSchema() {
  if (hotelsSchemaVerified) return;
  try {
    // 1. Create hotels table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hotels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        category VARCHAR(50) NOT NULL,
        location VARCHAR(200) NOT NULL,
        city VARCHAR(100) NOT NULL,
        rating DECIMAL(2, 1) DEFAULT 4.5,
        price_per_night DECIMAL(10, 2) NOT NULL,
        description TEXT,
        main_image VARCHAR(500) NOT NULL,
        gallery_images TEXT,
        amenities TEXT,
        breakfast_info VARCHAR(150) DEFAULT 'Complimentary Gourmet Buffet',
        breakfast_included TINYINT(1) DEFAULT 1,
        breakfast_price DECIMAL(10, 2) DEFAULT 0.00,
        check_in_time VARCHAR(20) DEFAULT '14:00',
        check_out_time VARCHAR(20) DEFAULT '11:00',
        total_rooms INT DEFAULT 50,
        room_types TEXT,
        policies TEXT,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 2. Check if hotels table has 20 records
    const [countRows] = await pool.query(`SELECT COUNT(*) as count FROM hotels`);
    if (countRows[0].count === 0) {
      console.log('🔄 Seeding exactly 20 diverse hotels for Accommodation module...');
      for (const h of INITIAL_20_HOTELS) {
        await pool.query(
          `INSERT INTO hotels 
            (name, category, location, city, rating, price_per_night, description, main_image, gallery_images, amenities, breakfast_info, breakfast_included, breakfast_price, check_in_time, check_out_time, total_rooms, room_types, policies, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            h.name,
            h.category,
            h.location,
            h.city,
            h.rating,
            h.price_per_night,
            h.description,
            h.main_image,
            h.gallery_images,
            h.amenities,
            h.breakfast_info,
            h.breakfast_included,
            h.breakfast_price,
            h.check_in_time,
            h.check_out_time,
            h.total_rooms,
            h.room_types,
            h.policies,
            'ACTIVE'
          ]
        );
      }
      console.log('✅ Exactly 20 hotels successfully seeded in MySQL database!');
    }

    hotelsSchemaVerified = true;
  } catch (err) {
    console.warn('Hotels schema notice:', err.message);
  }
}

/**
 * Format a hotel row to parse JSON arrays
 */
function formatHotelRow(row) {
  if (!row) return null;
  let gallery = [];
  let amenities = [];
  let roomTypes = [];

  try {
    gallery = typeof row.gallery_images === 'string' ? JSON.parse(row.gallery_images) : row.gallery_images || [];
  } catch (e) { gallery = []; }

  try {
    amenities = typeof row.amenities === 'string' ? JSON.parse(row.amenities) : row.amenities || [];
  } catch (e) { amenities = []; }

  try {
    roomTypes = typeof row.room_types === 'string' ? JSON.parse(row.room_types) : row.room_types || [];
  } catch (e) { roomTypes = []; }

  return {
    ...row,
    rating: parseFloat(row.rating || 4.5),
    price_per_night: parseFloat(row.price_per_night || 0),
    breakfast_price: parseFloat(row.breakfast_price || 0),
    breakfast_included: Boolean(row.breakfast_included),
    gallery_images: Array.isArray(gallery) ? gallery : [],
    amenities: Array.isArray(amenities) ? amenities : [],
    room_types: Array.isArray(roomTypes) ? roomTypes : []
  };
}

/**
 * GET /api/hotels
 * List all hotels with filters (category, city, search, price range)
 */
async function getHotels(req, res, next) {
  try {
    await ensureHotelsSchema();
    const { category, city, search, min_price, max_price } = req.query;

    let query = `SELECT * FROM hotels WHERE 1=1`;
    const params = [];

    if (category && category !== 'ALL') {
      query += ` AND category = ?`;
      params.push(category);
    }
    if (city && city !== 'ALL') {
      query += ` AND city = ?`;
      params.push(city);
    }
    if (search && search.trim()) {
      query += ` AND (name LIKE ? OR location LIKE ? OR city LIKE ? OR description LIKE ?)`;
      const p = `%${search.trim()}%`;
      params.push(p, p, p, p);
    }
    if (min_price) {
      query += ` AND price_per_night >= ?`;
      params.push(parseFloat(min_price));
    }
    if (max_price) {
      query += ` AND price_per_night <= ?`;
      params.push(parseFloat(max_price));
    }

    query += ` ORDER BY rating DESC, price_per_night ASC`;

    const [rows] = await pool.query(query, params);
    const hotels = rows.map(formatHotelRow);

    // Get distinct categories & cities for filter dropdowns
    const [catRows] = await pool.query(`SELECT DISTINCT category FROM hotels ORDER BY category ASC`);
    const categories = catRows.map(c => c.category).filter(Boolean);

    const [cityRows] = await pool.query(`SELECT DISTINCT city FROM hotels ORDER BY city ASC`);
    const cities = cityRows.map(c => c.city).filter(Boolean);

    return sendSuccess(res, {
      hotels,
      total: hotels.length,
      categories,
      cities
    }, 'Hotels fetched successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/hotels/:id
 * Detailed hotel record with linked rooms and operational stats
 */
async function getHotelById(req, res, next) {
  try {
    await ensureHotelsSchema();
    const { id } = req.params;

    const [rows] = await pool.query(`SELECT * FROM hotels WHERE id = ?`, [id]);
    if (rows.length === 0) {
      return sendError(res, 'Hotel not found', 404);
    }

    const hotel = formatHotelRow(rows[0]);

    // Fetch rooms associated with this hotel
    const [roomRows] = await pool.query(`SELECT * FROM rooms ORDER BY room_number ASC`);

    return sendSuccess(res, {
      ...hotel,
      rooms: roomRows
    }, 'Hotel details fetched successfully');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getHotels,
  getHotelById,
  ensureHotelsSchema
};
