
import React, { useState } from 'react';
import type { User } from '../types';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('පරිශීලක නාමය සහ මුරපදය හිස් විය නොහැක.');
      return;
    }
    try {
      const users = JSON.parse(localStorage.getItem('users') || '{}');
      if (users[username]) {
        setError('මෙම පරිශීලක නාමය දැනටමත් භාවිතයේ ඇත. කරුණාකර ඇතුල් වන්න.');
        return;
      }
      users[username] = { password }; // In a real app, hash the password!
      localStorage.setItem('users', JSON.stringify(users));
      onLogin({ username });
    } catch (err) {
      setError('අනපේක්ෂිත දෝෂයක් ඇතිවිය.');
      console.error(err);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('පරිශීලක නාමය සහ මුරපදය හිස් විය නොහැක.');
      return;
    }
    try {
      const users = JSON.parse(localStorage.getItem('users') || '{}');
      if (users[username] && users[username].password === password) {
        onLogin({ username });
      } else {
        setError('පරිශීලක නාමය හෝ මුරපදය වැරදියි.');
      }
    } catch (err) {
      setError('අනපේක්ෂිත දෝෂයක් ඇතිවිය.');
      console.error(err);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-8 bg-gray-800 rounded-lg shadow-lg">
        <div>
          <h2 className="text-3xl font-bold text-center text-white">
            මදු වෙත සාදරයෙන් පිළිගනිමු
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            ඔබේ AI සහායක
          </p>
        </div>
        <form className="mt-8 space-y-6">
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 placeholder-gray-500 text-white rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="පරිශීලක නාමය"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 placeholder-gray-500 text-white rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="මුරපදය"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="mt-2 text-center text-sm text-red-400">{error}</p>}

          <div className="flex items-center justify-between gap-4 mt-6">
            <button
              type="submit"
              onClick={handleLogin}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
            >
              ඇතුල් වන්න
            </button>
            <button
              type="button"
              onClick={handleSignup}
              className="group relative w-full flex justify-center py-3 px-4 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500"
            >
              ලියාපදිංචි වන්න
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Auth;
