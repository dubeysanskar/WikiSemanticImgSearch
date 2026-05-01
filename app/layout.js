import './globals.css';
import Providers from './components/Providers';

export const metadata = {
  title: 'WikiSemanticImgSearch — Semantic Image Search for Wikimedia Commons',
  description: 'Search Wikimedia Commons images using natural language and AI vision embeddings. Discover freely-licensed images through semantic understanding, category browsing, and resolution filtering.',
  icons: {
    icon: '/commons-logo.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
