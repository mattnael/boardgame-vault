Boardgame Vault

Boardgame Vault is a web-based board game collection and catalog management application designed to help enthusiasts, communities, or hobby shops efficiently organize collections, track rental statuses, and monitor item availability in real time.

================================================================================

PROJECT DESCRIPTION & RATIONALE
================================================================================

Background & Purpose:
The primary reason for choosing the Boardgame Vault case study is the need to build a modern distributed system that goes beyond a single service, utilizing a multi-tier architecture that includes:

Core Application Service (Node.js/Express): Handles business logic, asset management, and the web interface.

Relational Database (PostgreSQL): Stores structured persistent data (users, board game data, transactions, and rental relations).

In-Memory Cache (Redis): Provides rapid caching to improve data access performance and system health monitoring.

================================================================================
2. SYSTEM ARCHITECTURE & TECHNOLOGY STACK

Frontend & Backend: Node.js, Express.js, JavaScript, HTML5, CSS3 / Tailwind (built using Docker's multi-stage build approach).

Database: PostgreSQL 15-alpine (with named volumes for data persistence).

Cache & Session: Redis 7-alpine (with automated healthchecks).

Containerization: Docker & Docker Compose (Bridge network, environment isolation).

================================================================================
3. QUICK START GUIDE

Anyone can run this project locally using the following steps:

Clone the repository:
git clone https://github.com/mattnael/boardgame-vault.git
cd boardgame-vault

Configure Environment Variables:
Copy the example environment file and adjust values if necessary:
cp .env.example .env

Run the application using Docker Compose:
Ensure Docker Desktop is running, then execute the following command (all-in-one command):
docker compose up -d --build

Access the Application in Your Browser:
Open your favorite browser and visit:
http://localhost:3000

Stopping the Application:

To stop containers without deleting database data:
docker compose down

To stop and completely wipe container data/volumes:
docker compose down -v

================================================================================
4. ARTICLE & VIDEO DEMO LINKS

Technical Article / Documentation: [https://medium.com/@mattnael07/boardgame-vault-158ffe73a196?sharedUserId=mattnael07]

Project Demo Video: [https://youtu.be/SE07lyuN1zY]

================================================================================
5. AI USAGE DECLARATION

During the development of the Boardgame Vault project, artificial intelligence (AI) was transparently utilized as a technical collaboration assistant (AI collaborator) to support design efficiency and troubleshoot technical issues:

Scope of AI Assistance:

Providing reference structures and best practices for configuring multi-stage builds in the Dockerfile.

Assisting in organizing orchestration configurations in docker-compose.yml, including healthchecks, named volumes, and user-defined networks.

Assisting with debugging and troubleshooting when encountering issues running Docker commands or testing endpoints.

Developer Responsibility and Contribution:

All architectural design decisions, database integrations, code validations, local verification testing, and final adjustments were independently executed and tested by the developer.

The developer takes full responsibility for the functional correctness, security, and thorough understanding of all source code published in this repository.
