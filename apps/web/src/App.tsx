import { Routes, Route } from 'react-router-dom';

function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background-primary">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-text-primary mb-4">
          SoloCompass
        </h1>
        <p className="text-text-secondary text-lg">
          Solo-traveller safety and planning app
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}
