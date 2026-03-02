# Balawi Backend API

Backend API for Customer Management System built with Express.js and MongoDB.

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or Atlas)

### Installation

```bash
# Install dependencies
npm install

# Create .env file (copy from example)
cp .env.example .env

# Edit .env and set your MongoDB URI
```

### Running the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server will run on `http://localhost:3000`

---

## 📁 Project Structure

```
balawi_backend/
├── config/
│   └── db.js              # MongoDB connection
├── controllers/
│   └── customerController.js  # Business logic
├── middlewares/
│   └── errorHandler.js    # Error handling
├── models/
│   └── Customer.js        # Mongoose schema
├── routes/
│   └── customerRoutes.js  # API routes
├── utils/
│   └── response.js        # Unified response helper
├── .env                   # Environment variables
├── .env.example           # Example env file
├── index.js               # App entry point
└── package.json
```

---

## 📋 API Documentation

### Base URL

```
http://localhost:3000/api
```

### Response Format (Unified)

All APIs return this format:

```json
{
  "success": true/false,
  "statusCode": 200,
  "message": "Success message",
  "data": { ... }
}
```

---

## 👥 Customer APIs

### 1. Get All Customers

```
GET /api/customers
```

**Query Parameters (Optional):**
| Parameter | Type | Description |
|-----------|--------|--------------------------------|
| search | string | Search by customer name |
| letter | string | Filter by first letter of name |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 10) |

**Examples:**

```bash
# Get all customers
GET /api/customers

# Search by name
GET /api/customers?search=أحمد

# Filter by letter
GET /api/customers?letter=م

# With pagination
GET /api/customers?page=2&limit=20

# Combined
GET /api/customers?search=محمد&letter=م&page=1&limit=10
```

**Response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Customers retrieved successfully",
  "data": {
    "customers": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 50,
      "itemsPerPage": 10
    }
  }
}
```

---

### 2. Get Customer by ID

```
GET /api/customers/:id
```

**Response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Customer retrieved successfully",
  "data": {
    "_id": "...",
    "fullName": "محمد أحمد",
    "phoneNumber": "0599123456",
    "height": 175,
    "width": 80,
    "type": "regular",
    "notes": "ملاحظات العميل",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### 3. Create Customer

```
POST /api/customers
```

**Request Body:**

```json
{
  "fullName": "محمد أحمد", // required
  "phoneNumber": "0599123456", // required
  "height": 175, // optional
  "width": 80, // optional
  "type": "regular", // optional
  "notes": "ملاحظات" // optional
}
```

**Response:**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Customer created successfully",
  "data": { ... }
}
```

---

### 4. Update Customer

```
PUT /api/customers/:id
```

**Request Body (all fields optional):**

```json
{
  "fullName": "الاسم الجديد",
  "phoneNumber": "0599999999",
  "height": 180,
  "width": 85,
  "type": "vip",
  "notes": "ملاحظات جديدة"
}
```

**Response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Customer updated successfully",
  "data": { ... }
}
```

---

### 5. Delete Customer

```
DELETE /api/customers/:id
```

**Response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Customer deleted successfully",
  "data": { ... }
}
```

---

## 🔧 Customer Model

| Field       | Type   | Required | Default |
| ----------- | ------ | -------- | ------- |
| fullName    | String | Yes      | -       |
| phoneNumber | String | Yes      | -       |
| height      | Number | No       | 0       |
| width       | Number | No       | 0       |
| type        | String | No       | ""      |
| notes       | String | No       | ""      |
| createdAt   | Date   | Auto     | -       |
| updatedAt   | Date   | Auto     | -       |

---

## 💡 Flutter Integration Example

```dart
// Using http package
import 'dart:convert';
import 'package:http/http.dart' as http;

class CustomerService {
  final String baseUrl = 'http://localhost:3000/api';

  // Get all customers
  Future<Map<String, dynamic>> getAllCustomers({
    String? search,
    String? letter,
    int page = 1,
    int limit = 10,
  }) async {
    var uri = Uri.parse('$baseUrl/customers').replace(
      queryParameters: {
        if (search != null) 'search': search,
        if (letter != null) 'letter': letter,
        'page': page.toString(),
        'limit': limit.toString(),
      },
    );

    final response = await http.get(uri);
    return json.decode(response.body);
  }

  // Create customer
  Future<Map<String, dynamic>> createCustomer(Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/customers'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(data),
    );
    return json.decode(response.body);
  }
}
```

---

## 📝 Notes

- All responses follow a unified format for easy handling in Flutter
- MongoDB ObjectId is used as the customer ID (`_id`)
- Timestamps (createdAt, updatedAt) are added automatically
- CORS is enabled for cross-origin requests from Flutter apps
