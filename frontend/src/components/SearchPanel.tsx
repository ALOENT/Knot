import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, UserPlus, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import debounce from 'lodash.debounce';

export interface SearchResult {
  id: string;
  username: string;
  email: string;
  profilePic: string | null;
  isOnline: boolean;
  bio: string | null;
}

interface SearchPanelProps {
  onMessageUser: (user: SearchResult) => void;
  onAddContact?: (user: SearchResult) => void;
}

export default function SearchPanel({ onMessageUser, onAddContact }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const handleSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        if (isMountedRef.current) {
          setResults([]);
          setHasSearched(false);
        }
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        if (isMountedRef.current) {
          setIsLoading(true);
        }
        const res = await api.get(`/users/search?query=${encodeURIComponent(searchQuery)}`, {
          signal: abortControllerRef.current.signal,
        });
        if (isMountedRef.current) {
          setResults(res.data.users || []);
          setHasSearched(true);
        }
      } catch (error: any) {
        if (error.name === 'CanceledError' || error?.response?.status === 499) {
          return;
        }
        console.error('Search failed', error);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    }, 400),
    []
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      handleSearch.cancel();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [handleSearch]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    handleSearch(val);
  };

  return (
    <div className="flex flex-col h-full w-full bg-black/40 backdrop-blur-md">
      <div className="p-6 border-b border-white/[0.04]">
        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 mb-4">
          Discover
        </h2>
        
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
          </div>
          <input
            type="text"
            className="w-full bg-[#111] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]"
            placeholder="Search by username or email..."
            value={query}
            onChange={onInputChange}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && hasSearched && results.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-500 text-sm">No users found matching "{query}"</p>
          </div>
        )}

        {!isLoading && results.map((user) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={user.id}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.02] transition-colors group cursor-default"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg">
                  {user.profilePic ? (
                    <img
                      src={user.profilePic}
                      alt={user.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    user.username.charAt(0).toUpperCase()
                  )}
                </div>
                {user.isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#1a1a1a]" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">{user.username}</span>
                {user.bio ? (
                  <span className="text-xs text-gray-500 truncate max-w-[150px]">{user.bio}</span>
                ) : (
                  <span className="text-xs text-gray-600 truncate max-w-[150px]">{user.email}</span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onMessageUser(user)}
                className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                title="Message"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                onClick={() => onAddContact?.(user)}
                disabled={!onAddContact}
                className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={onAddContact ? 'Add Contact' : 'Add Contact (Coming Soon)'}
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}

        {!hasSearched && query === '' && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-600 space-y-4">
             <Search className="w-12 h-12 opacity-20" />
             <p className="text-sm">Type a username to start discovering.</p>
          </div>
        )}
      </div>
    </div>
  );
}
