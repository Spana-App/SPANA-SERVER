# 🌐 Website API Endpoints (Public Only)

**Base URL:** `http://localhost:5003` (or your production URL)

All endpoints are **PUBLIC** - no authentication required. Perfect for your website!

---

## 📊 Statistics Endpoints

### 1. Platform Overview Stats
**GET** `/stats/platform`

Perfect for homepage hero section.

**Example:**
```javascript
fetch('http://localhost:5003/stats/platform')
  .then(res => res.json())
  .then(data => {
    console.log(`Total Users: ${data.users.total}`);
    console.log(`Active Providers: ${data.users.activeProviders}`);
    console.log(`Total Bookings: ${data.bookings.total}`);
  });
```

**Response:**
```json
{
  "users": {
    "total": 18,
    "providers": 8,
    "customers": 8,
    "activeProviders": 8
  },
  "services": {
    "total": 16
  },
  "bookings": {
    "total": 30,
    "completed": 6,
    "completionRate": "20.00"
  },
  "revenue": {
    "total": 4500.50
  }
}
```

---

### 2. Providers by Location
**GET** `/stats/providers/location`

Show "Find providers in your city" section.

**Example:**
```javascript
fetch('http://localhost:5003/stats/providers/location')
  .then(res => res.json())
  .then(data => {
    data.locations.forEach(location => {
      console.log(`${location.city}: ${location.providerCount} providers`);
    });
  });
```

**Response:**
```json
{
  "locations": [
    {
      "city": "Johannesburg",
      "providerCount": 5,
      "totalServices": 10,
      "completedBookings": 15,
      "averageRating": "4.25"
    },
    {
      "city": "Cape Town",
      "providerCount": 3,
      "totalServices": 6,
      "completedBookings": 8,
      "averageRating": "4.50"
    }
  ],
  "total": 2
}
```

---

### 3. Service Categories
**GET** `/stats/services/categories`

Display service category cards on homepage.

**Example:**
```javascript
fetch('http://localhost:5003/stats/services/categories')
  .then(res => res.json())
  .then(data => {
    data.categories.forEach(cat => {
      console.log(`${cat.category}: ${cat.serviceCount} services`);
    });
  });
```

**Response:**
```json
{
  "categories": [
    {
      "category": "Plumbing",
      "serviceCount": 4,
      "totalBookings": 12,
      "totalRevenue": 4800.00,
      "averagePrice": "400.00"
    },
    {
      "category": "Cleaning",
      "serviceCount": 3,
      "totalBookings": 8,
      "totalRevenue": 2400.00,
      "averagePrice": "300.00"
    }
  ],
  "total": 3
}
```

---

### 4. Top Providers
**GET** `/stats/providers/top?limit=10`

Featured providers section.

**Query Parameters:**
- `limit` (optional): Number of providers (default: 10)

**Example:**
```javascript
fetch('http://localhost:5003/stats/providers/top?limit=5')
  .then(res => res.json())
  .then(data => {
    data.providers.forEach(provider => {
      console.log(`${provider.name}: ⭐ ${provider.rating}`);
    });
  });
```

**Response:**
```json
{
  "providers": [
    {
      "id": "cmic7dnxz000j4e7ccw1ez6ny",
      "name": "John Doe",
      "email": "john.doe@provider.com",
      "rating": 4.8,
      "totalReviews": 25,
      "totalBookings": 45,
      "totalRevenue": 18000.00,
      "location": {
        "type": "Point",
        "coordinates": [28.0473, -26.2041],
        "address": "123 Main Street, Johannesburg"
      }
    }
  ],
  "limit": 5
}
```

---

### 5. Booking Trends
**GET** `/stats/bookings/trends`

For charts/graphs showing platform growth.

**Example:**
```javascript
fetch('http://localhost:5003/stats/bookings/trends')
  .then(res => res.json())
  .then(data => {
    data.trends.forEach(trend => {
      console.log(`${trend.date}: ${trend.total} bookings`);
    });
  });
```

**Response:**
```json
{
  "trends": [
    {
      "date": "2024-11-01",
      "total": 5,
      "completed": 2,
      "revenue": 1200.00
    },
    {
      "date": "2024-11-02",
      "total": 3,
      "completed": 1,
      "revenue": 600.00
    }
  ],
  "period": "30 days"
}
```

---

## 🔍 Service Endpoints

### 6. Get All Services
**GET** `/services`

Browse all available services.

**Query Parameters:**
- `category` (optional): Filter by category (e.g., `?category=Plumbing`)
- `minPrice` (optional): Minimum price
- `maxPrice` (optional): Maximum price
- `limit` (optional): Results per page (default: 20)
- `offset` (optional): Pagination offset

**Example:**
```javascript
// All services
fetch('http://localhost:5003/services')

// Plumbing only
fetch('http://localhost:5003/services?category=Plumbing')

// Price range
fetch('http://localhost:5003/services?minPrice=200&maxPrice=500')
```

**Response:**
```json
{
  "services": [
    {
      "id": "cmic7dnxz000j4e7ccw1ez6ny",
      "title": "Emergency Plumbing",
      "description": "Professional emergency plumbing services",
      "category": "Plumbing",
      "price": 500.00,
      "duration": 120,
      "mediaUrl": "https://example.com/services/plumbing.jpg",
      "status": "active",
      "adminApproved": true,
      "provider": {
        "id": "cmic7dnxz000j4e7ccw1ez6ny",
        "firstName": "John",
        "lastName": "Doe",
        "rating": 4.8,
        "totalReviews": 25
      }
    }
  ],
  "total": 16
}
```

---

### 7. Get Service by ID
**GET** `/services/:id`

Service detail page.

**Example:**
```javascript
fetch('http://localhost:5003/services/cmic7dnxz000j4e7ccw1ez6ny')
  .then(res => res.json())
  .then(service => {
    console.log(service.title);
    console.log(`Price: R${service.price}`);
    console.log(`Provider: ${service.provider.firstName} ${service.provider.lastName}`);
  });
```

**Response:**
```json
{
  "id": "cmic7dnxz000j4e7ccw1ez6ny",
  "title": "Emergency Plumbing",
  "description": "Professional emergency plumbing services",
  "category": "Plumbing",
  "price": 500.00,
  "duration": 120,
  "mediaUrl": "https://example.com/services/plumbing.jpg",
  "status": "active",
  "adminApproved": true,
  "provider": {
    "id": "cmic7dnxz000j4e7ccw1ez6ny",
    "firstName": "John",
    "lastName": "Doe",
    "rating": 4.8,
    "totalReviews": 25,
    "skills": ["Plumbing", "Electrical"],
    "experienceYears": 8
  },
  "bookings": {
    "total": 12,
    "completed": 8,
    "averageRating": 4.5
  }
}
```

---

## 👥 Provider Endpoints

### 8. Get All Providers
**GET** `/users/providers`

Provider directory/search.

**Query Parameters:**
- `category` (optional): Filter by service category
- `location` (optional): Filter by location (format: `lat,lng`)
- `radius` (optional): Search radius in km (default: 25)
- `limit` (optional): Results per page (default: 20)
- `offset` (optional): Pagination offset

**Example:**
```javascript
// All providers
fetch('http://localhost:5003/users/providers')

// Near location
fetch('http://localhost:5003/users/providers?location=-26.2041,28.0473&radius=10')

// By category
fetch('http://localhost:5003/users/providers?category=Plumbing')
```

**Response:**
```json
{
  "providers": [
    {
      "_id": "cmic7dnxz000j4e7ccw1ez6ny",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@provider.com",
      "profileImage": "https://i.pravatar.cc/150?img=1",
      "rating": 4.8,
      "totalReviews": 25,
      "skills": ["Plumbing", "Electrical"],
      "experienceYears": 8,
      "isOnline": true,
      "isVerified": true,
      "isProfileComplete": true,
      "location": {
        "type": "Point",
        "coordinates": [28.0473, -26.2041],
        "address": "123 Main Street, Johannesburg"
      }
    }
  ],
  "total": 8
}
```

---

## 📱 React/Next.js Examples

### Homepage Stats Component
```jsx
import { useEffect, useState } from 'react';

export default function HomepageStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5003/stats/platform')
      .then(res => res.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  if (!stats) return <div>Loading...</div>;

  return (
    <section className="stats-section">
      <div className="container">
        <h2>Join Thousands of Happy Customers</h2>
        <div className="stats-grid">
          <div className="stat">
            <h3>{stats.users.total}+</h3>
            <p>Total Users</p>
          </div>
          <div className="stat">
            <h3>{stats.users.activeProviders}</h3>
            <p>Active Providers</p>
          </div>
          <div className="stat">
            <h3>{stats.bookings.total}</h3>
            <p>Bookings Completed</p>
          </div>
          <div className="stat">
            <h3>R{stats.revenue.total.toLocaleString()}</h3>
            <p>Total Revenue</p>
          </div>
        </div>
      </div>
    </section>
  );
}
```

### Service Categories Component
```jsx
import { useEffect, useState } from 'react';

export default function ServiceCategories() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch('http://localhost:5003/stats/services/categories')
      .then(res => res.json())
      .then(data => setCategories(data.categories))
      .catch(console.error);
  }, []);

  return (
    <section className="categories-section">
      <h2>Our Services</h2>
      <div className="categories-grid">
        {categories.map(cat => (
          <div key={cat.category} className="category-card">
            <h3>{cat.category}</h3>
            <p>{cat.serviceCount} Services Available</p>
            <p className="price">From R{cat.averagePrice}</p>
            <p className="bookings">{cat.totalBookings} Bookings</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

### Top Providers Component
```jsx
import { useEffect, useState } from 'react';

export default function TopProviders() {
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    fetch('http://localhost:5003/stats/providers/top?limit=6')
      .then(res => res.json())
      .then(data => setProviders(data.providers))
      .catch(console.error);
  }, []);

  return (
    <section className="providers-section">
      <h2>Top Rated Providers</h2>
      <div className="providers-grid">
        {providers.map(provider => (
          <div key={provider.id} className="provider-card">
            <img 
              src={provider.profileImage || '/default-avatar.png'} 
              alt={provider.name}
            />
            <h3>{provider.name}</h3>
            <div className="rating">
              ⭐ {provider.rating.toFixed(1)} ({provider.totalReviews} reviews)
            </div>
            <p>{provider.totalBookings} bookings completed</p>
            <p className="location">{provider.location?.address}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

### Service Listing Component
```jsx
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ServiceList({ category }) {
  const [services, setServices] = useState([]);

  useEffect(() => {
    const url = category 
      ? `http://localhost:5003/services?category=${category}`
      : 'http://localhost:5003/services';
    
    fetch(url)
      .then(res => res.json())
      .then(data => setServices(data.services))
      .catch(console.error);
  }, [category]);

  return (
    <div className="services-grid">
      {services.map(service => (
        <Link key={service.id} href={`/services/${service.id}`}>
          <div className="service-card">
            <img src={service.mediaUrl} alt={service.title} />
            <h3>{service.title}</h3>
            <p>{service.description}</p>
            <div className="service-meta">
              <span className="price">R{service.price}</span>
              <span className="duration">{service.duration} min</span>
            </div>
            <div className="provider-info">
              <span>{service.provider.firstName} {service.provider.lastName}</span>
              <span>⭐ {service.provider.rating}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
```

---

## 🎯 Quick Reference

| Endpoint | Purpose | Use On |
|----------|---------|--------|
| `GET /stats/platform` | Overall stats | Homepage hero |
| `GET /stats/providers/location` | Location stats | "Find in your city" |
| `GET /stats/services/categories` | Category breakdown | Service categories section |
| `GET /stats/providers/top?limit=10` | Top providers | Featured section |
| `GET /stats/bookings/trends` | Booking trends | Growth charts |
| `GET /services` | All services | Service listings page |
| `GET /services?category=Plumbing` | Filtered services | Category pages |
| `GET /services/:id` | Service details | Service detail page |
| `GET /users/providers` | Provider directory | Provider search page |
| `GET /users/providers?location=lat,lng` | Nearby providers | Location-based search |

---

## ⚠️ Important Notes

1. **All Public**: No authentication needed
2. **CORS**: Ensure backend allows your website domain
3. **Caching**: Recommended to cache responses (5-10 minutes)
4. **Error Handling**: Always handle errors in your frontend
5. **Rate Limiting**: Consider implementing for production

---

**That's it!** These are all the public endpoints you need for your website. No CMS/admin endpoints included.
