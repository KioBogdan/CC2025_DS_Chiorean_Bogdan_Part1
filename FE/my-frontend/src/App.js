import React, { useState } from 'react'; 
import './App.css';

function App() {
  const [message, setMessage] = useState('') //store message from backend
  
  //Button click function
  const connectToBackend = () => {
    const apiBaseUrl = process.env.REACT_UI_APP_AZURE_URL;
    
    //GET request to FastAPI backend //fetch('http://localhost:8000/api/connect')
    fetch('${apiBaseUrl}/api/connect')
      .then(response => {
        if(!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json(); //Parse JSON response
      })
      .then(data => {
        setMessage(data.message) //update state with the message from backend
      })
      .catch(error => {
        console.error('Error connecting to backend:', error);
        setMessage('Failed to connect to backend.');
      });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Part 1 - Test connection </h1>

        <button onClick={connectToBackend}>
          Connect backend
        </button>

        {message && <p>{message}</p>}
        {/* <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a> */}
      </header>
    </div>
  );
}

export default App;
