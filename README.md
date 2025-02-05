# S P R I T E boi

SPRITE is a powerful multimodal generation platform that combines AI-powered image, music, and sprite video generation with advanced semantic search capabilities - all within your browser's memory. 

Once it's loaded you can even go offline and the app will be fully functional! 

Recent advances in small language models and generative music and image models have made it possible to build a mini multimodal application that never leaves your browser. 

That mean's your chrome tab is literally running:

- Three separate SOTA tiny generative models with vision, text, audio understanding with chat and generation capabilities. Generate (smol) sprite based music videos right in your browser
- A full PostGres database thanks to PGLite WASM database that saves to your local disk for persistence. 
- **Never done before in an app** A full Model Context Protocol server directly integrated with your browser's memory (https://modelcontextprotocol.io/introduction) that can intelligently manage context, memory, and tools for the LLMs
- Intelligent search and storage of all your generated assets and chat logs, with memory and memory retrieval
- Fully managed SQL queries and tools to allow the models to execute database commands, use the internet, and complete tasks for you - baby agents :)
- Accelerated and powered by your GPUs without having to download or install anything



## Features

### 🎨 Media Generation
- **Image Generation**: Create images from text descriptions using advanced AI models
- **Music Generation**: Generate music tracks with customizable duration and BPM
- **Sprite Videos**: Create animated sprite sheets with synchronized music
- **Style Controls**: Customize generation with style parameters and frame controls

### 🔍 Smart Search
- **Semantic Search**: Find generations using natural language queries
- **Object Detection**: Automatic segmentation of objects in generated images
- **Real-time Results**: Instant search with debounced queries
- **Visual Previews**: Grid view with hover details and quick actions

### 💾 Database & Storage
- **PGlite Integration**: Browser-based PostgreSQL database
- **Vector Search**: Efficient similarity-based content retrieval
- **Blob Storage**: Efficient storage of generated media
- **Background Sync**: Automatic synchronization with service worker support

### 🛠️ Technical Features
- **WebGPU Acceleration**: Hardware-accelerated AI processing
- **Progressive Loading**: Lazy loading and image optimization
- **Offline Support**: Service worker for offline functionality
- **Cross-tab Sync**: Coordinated state management across browser tabs

## Getting Started

### Prerequisites
- Node.js 18 or higher
- Modern browser with WebGPU support (Chrome/Edge recommended)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/wheattoast11/SPRITEboi.git
cd sprite-studio
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

### Development

The project uses:
- Vite for development and building
- React with TypeScript
- Tailwind CSS for styling
- PGlite for database operations
- Model Context Protocol for AI operations

### Project Structure

```
sprite-studio/
├── src/
│   ├── components/      # React components
│   ├── contexts/        # React context providers
│   ├── lib/            # Core utilities and services
│   ├── workers/        # Web Workers for AI processing
│   └── types.ts        # TypeScript definitions
├── public/             # Static assets
└── supabase/          # Database migrations
```

## Usage

### Generating Media

1. Select the desired generation type (Image, Music, or Sprite)
2. Enter a descriptive prompt
3. Adjust optional parameters (style, duration, BPM)
4. Click "Generate" to create your content

### Searching Content

- Use the search bar to find generations using natural language
- Results are sorted by relevance with similarity scores
- Hover over items to see details and download options

### Exporting

- Click the download button on any generation to save it
- Sprite videos can be exported with their associated music
- Batch export available through the ZIP download option

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Hugging Face for transformer models
- Electric SQL for PGlite
- Anthropic for the incredible Model Context Protocol
- DeepSeek and Meta for creating incredible local open source models
