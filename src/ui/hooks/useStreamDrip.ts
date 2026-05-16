import { useState, useEffect, useRef } from 'react';

/**
 * A hook that takes accumulated content and drips it character by character
 * to create a smooth, true typewriter effect regardless of how fast the
 * model sends tokens.
 * 
 * @param fullContent The total content received from the model so far
 * @param isStreaming Whether the model is still generating
 * @param charDelay   Delay between characters in ms (default 20ms)
 */
export const useStreamDrip = (
  fullContent: string, 
  isStreaming: boolean, 
  charDelay: number = 20
) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isDripping, setIsDripping] = useState(false);
  const queueRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When fullContent changes, we update the queue of characters yet to be displayed
  useEffect(() => {
    if (fullContent.length > displayedContent.length + queueRef.current.length) {
      const newChars = fullContent.slice(displayedContent.length + queueRef.current.length);
      queueRef.current += newChars;
      
      if (!isDripping) {
        startDripping();
      }
    }
  }, [fullContent]);

  const startDripping = () => {
    setIsDripping(true);
    
    const dripNext = () => {
      if (queueRef.current.length > 0) {
        const nextChar = queueRef.current[0];
        queueRef.current = queueRef.current.slice(1);
        
        setDisplayedContent(prev => prev + nextChar);
        
        // Dynamic delay: space/punctuation might want a slight pause,
        // but for now we keep it constant for consistency.
        timerRef.current = setTimeout(dripNext, charDelay);
      } else {
        setIsDripping(false);
        timerRef.current = null;
      }
    };

    dripNext();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    displayedContent,
    isDripping: isDripping || isStreaming
  };
};
