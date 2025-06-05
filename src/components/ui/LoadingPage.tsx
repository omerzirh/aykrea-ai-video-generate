import React from 'react';

const LoadingPage: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <h2 className="text-2xl font-semibold text-foreground">Loading...</h2>
      </div>
    </div>
  );
};

export default LoadingPage; 