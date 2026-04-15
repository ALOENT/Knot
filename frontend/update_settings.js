const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsSection.tsx', 'utf-8');

// 1. Update imports and add state/refs
content = content.replace(
  "import React, { useState } from 'react';",
  "import React, { useState, useEffect, useRef } from 'react';"
);

content = content.replace(
  "const { currentUser } = useChat();",
  "const { currentUser, setCurrentUser } = useChat();"
);

content = content.replace(
  "const [message, setMessage] = useState('');",
  "const [message, setMessage] = useState('');\n  const [notificationsEnabled, setNotificationsEnabled] = useState(true);\n  const [darkModeEnabled, setDarkModeEnabled] = useState(true);\n  const fileInputRef = useRef<HTMLInputElement>(null);\n\n  useEffect(() => {\n    if (currentUser) {\n      setFormData(prev => ({\n        ...prev,\n        username: currentUser.username || prev.username,\n        displayName: (currentUser as any)?.displayName || prev.displayName,\n        bio: currentUser.bio || prev.bio,\n        profilePic: currentUser.profilePic || prev.profilePic,\n      }));\n    }\n  }, [currentUser]);"
);

// 2. Fix the handleSave logic to update context
content = content.replace(
  /\/\/ Update context with new user info[\s\S]*?setMessage\('Profile updated successfully\.'\);/g,
  `// Update context with new user info
        if (data.user) {
          setCurrentUser(data.user);
        }
        setMessage('Profile updated successfully.');`
);

// 3. Add avatar upload flow
content = content.replace(
  /<div className="relative group cursor-pointer">/g,
  `<input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                      setMessage('File size must be less than 5MB');
                      return;
                    }
                    if (formData.profilePic && formData.profilePic.startsWith('blob:')) {
                       URL.revokeObjectURL(formData.profilePic);
                    }
                    const url = URL.createObjectURL(file);
                    setFormData(prev => ({ ...prev, profilePic: url }));
                  }
                }}
              />
              <div 
                 className="relative group cursor-pointer" 
                 onClick={() => fileInputRef.current?.click()}
              >`
);

// 4. Update the toggle switches
const togglesOrig = `          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Setting Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Bell size={20} />
                </div>
                <div>
                  <h4 className="text-white text-sm font-medium">Desktop Notifications</h4>
                  <p className="text-white/40 text-xs">Receive alerts for new messages</p>
                </div>
              </div>
              <div className="w-10 h-6 bg-blue-600 rounded-full flex items-center px-1 cursor-pointer">
                <div className="w-4 h-4 bg-white rounded-full translate-x-4 shadow-sm" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Moon size={20} />
                </div>
                <div>
                  <h4 className="text-white text-sm font-medium">Dark Mode</h4>
                  <p className="text-white/40 text-xs">Always use deep blue theme</p>
                </div>
              </div>
              <div className="w-10 h-6 bg-blue-600 rounded-full flex items-center px-1 cursor-pointer">
                <div className="w-4 h-4 bg-white rounded-full translate-x-4 shadow-sm" />
              </div>
            </div>`;

const togglesNew = `          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Setting Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Bell size={20} />
                </div>
                <div>
                  <h4 className="text-white text-sm font-medium">Desktop Notifications</h4>
                  <p className="text-white/40 text-xs">Receive alerts for new messages</p>
                </div>
              </div>
              <div 
                className={\`w-10 h-6 rounded-full flex items-center px-1 cursor-pointer transition-colors \${notificationsEnabled ? 'bg-blue-600' : 'bg-gray-600'}\`}
                role="switch"
                aria-checked={notificationsEnabled}
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setNotificationsEnabled(!notificationsEnabled); }}
                tabIndex={0}
              >
                <div className={\`w-4 h-4 bg-white rounded-full shadow-sm transition-transform \${notificationsEnabled ? 'translate-x-4' : 'translate-x-0'}\`} />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Moon size={20} />
                </div>
                <div>
                  <h4 className="text-white text-sm font-medium">Dark Mode</h4>
                  <p className="text-white/40 text-xs">Always use deep blue theme</p>
                </div>
              </div>
              <div 
                className={\`w-10 h-6 rounded-full flex items-center px-1 cursor-pointer transition-colors \${darkModeEnabled ? 'bg-blue-600' : 'bg-gray-600'}\`}
                role="switch"
                aria-checked={darkModeEnabled}
                onClick={() => setDarkModeEnabled(!darkModeEnabled)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDarkModeEnabled(!darkModeEnabled); }}
                tabIndex={0}
              >
                <div className={\`w-4 h-4 bg-white rounded-full shadow-sm transition-transform \${darkModeEnabled ? 'translate-x-4' : 'translate-x-0'}\`} />
              </div>
            </div>`;

content = content.replace(togglesOrig, togglesNew);

fs.writeFileSync('src/components/SettingsSection.tsx', content);
console.log('SettingsSection.tsx updated');
