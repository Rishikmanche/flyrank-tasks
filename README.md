# Task API

A simple CRUD API for managing tasks, built with Express.js.

## Features

- Full CRUD operations (Create, Read, Update, Delete)
- Input validation
- In-memory storage
- Swagger UI documentation

## How to Install & Run

```bash
npm install
node index.js
```

Server starts at `http://localhost:3000`

## API Endpoints

| Method | Endpoint | Description | Status Codes |
|--------|----------|-------------|--------------|
| GET | `/` | API info | 200 |
| GET | `/health` | Health check | 200 |
| GET | `/tasks` | List all tasks | 200 |
| GET | `/tasks/:id` | Get task by ID | 200, 404 |
| POST | `/tasks` | Create a task | 201, 400 |
| PUT | `/tasks/:id` | Update a task | 200, 400, 404 |
| DELETE | `/tasks/:id` | Delete a task | 204, 404 |

## Example curl Output

```bash
$ curl -i -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Buy milk"}'

HTTP/1.1 201 Created
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 40
ETag: W/"28-PpSBYV7i68cXyGc7AhjVpkZkY5Q"
Date: Sun, 26 Jul 2026 16:55:15 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"title":"Buy milk","done":false}
```

## Swagger UI

Visit `http://localhost:3000/docs` to interact with the API documentation.

![Swagger UI](swagger-screenshot.png)

## Mortality Experiment

When you restart the server, all tasks are lost. The in-memory array resets to the 3 seed tasks. This demonstrates why databases exist — to persist data beyond the server's lifetime.

## Tech Stack

- Node.js
- Express.js
- swagger-ui-express
