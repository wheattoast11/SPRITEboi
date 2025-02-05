import React, { createContext, useContext, useReducer, useCallback } from 'react';

interface AppState {
  isLoading: boolean;
  error: Error | null;
  generationQueue: Array<{
    id: string;
    type: 'image' | 'music' | 'sprite_video';
    status: 'pending' | 'processing' | 'complete' | 'failed';
  }>;
  preferences: {
    theme: 'light' | 'dark';
    autoSync: boolean;
    notificationsEnabled: boolean;
  };
}

type AppAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: Error | null }
  | { type: 'ADD_TO_QUEUE'; payload: { id: string; type: string } }
  | { type: 'UPDATE_QUEUE_STATUS'; payload: { id: string; status: string } }
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<AppState['preferences']> };

const initialState: AppState = {
  isLoading: false,
  error: null,
  generationQueue: [],
  preferences: {
    theme: 'dark',
    autoSync: true,
    notificationsEnabled: true
  }
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  addToQueue: (type: string, id: string) => void;
  updateQueueStatus: (id: string, status: string) => void;
} | null>(null);

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'ADD_TO_QUEUE':
      return {
        ...state,
        generationQueue: [
          ...state.generationQueue,
          { ...action.payload, status: 'pending' }
        ]
      };
    case 'UPDATE_QUEUE_STATUS':
      return {
        ...state,
        generationQueue: state.generationQueue.map(item =>
          item.id === action.payload.id
            ? { ...item, status: action.payload.status }
            : item
        )
      };
    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.payload }
      };
    default:
      return state;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const addToQueue = useCallback((type: string, id: string) => {
    dispatch({ type: 'ADD_TO_QUEUE', payload: { type, id } });
  }, []);

  const updateQueueStatus = useCallback((id: string, status: string) => {
    dispatch({ type: 'UPDATE_QUEUE_STATUS', payload: { id, status } });
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch, addToQueue, updateQueueStatus }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}