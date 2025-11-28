import React from 'react';
import './App.css';
import ChatContainer from './components/ChatContainer';

/**
 * PUBLIC_INTERFACE
 * App is the root component that renders the ChatContainer.
 * It applies the Ocean Professional theme via CSS variables and wraps the entire chat UI.
 */
function App() {
  return (
    <div className="ocean-app">
      <ChatContainer />
    </div>
  );
}

export default App;
