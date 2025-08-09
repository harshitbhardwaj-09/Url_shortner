# URL Shortener

A modern URL shortener service built with Node.js and TypeScript.

## Project Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

### Development

1. Start the development server:
```bash
npm run dev
```

2. Build the project:
```bash
npm run build
```

3. Start the production server:
```bash
npm start
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the TypeScript project
- `npm start` - Start the production server
- `npm run watch` - Watch for TypeScript changes and compile

### Project Structure

```
url_shortner/
├── src/
│   └── index.ts      # Main application file
├── dist/             # Compiled JavaScript output
├── package.json      # Project dependencies and scripts
├── tsconfig.json     # TypeScript configuration
└── .gitignore        # Git ignore rules
```

### API Endpoints

- `GET /` - Welcome message
- `GET /health` - Health check endpoint

The server will start on `http://localhost:3000` by default.
