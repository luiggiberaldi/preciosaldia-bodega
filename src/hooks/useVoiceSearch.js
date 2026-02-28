import { useState, useRef } from 'react';
import { showToast } from '../components/Toast';

export function useVoiceSearch({ onResult, triggerHaptic }) {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessingAudio, setIsProcessingAudio] = useState(false);
    const recognitionRef = useRef(null);

    const toggleRecording = () => {
        if (isRecording) {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            setIsRecording(false);
            return;
        }

        // Web Speech API (nativa del navegador, sin necesidad de API key)
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showToast('Tu navegador no soporta búsqueda por voz.', 'warning');
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.lang = 'es-VE';
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                setIsRecording(true);
                triggerHaptic && triggerHaptic();
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                const cleanText = transcript.replace(/[.,!?]$/, '').trim();
                if (cleanText) {
                    onResult(cleanText);
                }
                setIsProcessingAudio(false);
            };

            recognition.onerror = (event) => {
                if (event.error === 'no-speech') {
                    showToast('No se detectó voz. Intenta de nuevo.', 'warning');
                } else if (event.error === 'not-allowed') {
                    showToast('Permiso de micrófono denegado. Actívalo en configuración.', 'warning');
                } else {
                    showToast('Error al procesar el audio. Inténtalo de nuevo.', 'error');
                }
                setIsRecording(false);
                setIsProcessingAudio(false);
            };

            recognition.onend = () => {
                setIsRecording(false);
            };

            recognitionRef.current = recognition;
            setIsProcessingAudio(true);
            recognition.start();
        } catch (error) {
            showToast('No se pudo iniciar el reconocimiento de voz.', 'error');
            setIsRecording(false);
            setIsProcessingAudio(false);
        }
    };

    return { isRecording, isProcessingAudio, toggleRecording };
}
