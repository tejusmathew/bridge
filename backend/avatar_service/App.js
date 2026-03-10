import './App.css'
import React from "react";
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import HeadlessRender from './Pages/HeadlessRender';

function App() {
  return (
    <Router>
      <Routes>
        <Route exact path='/headless' element={<HeadlessRender />} />
        <Route exact path='/sign-kit/headless' element={<HeadlessRender />} />
        <Route path='*' element={<HeadlessRender />} />
      </Routes>
    </Router>
  )
}

export default App;