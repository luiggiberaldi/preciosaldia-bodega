import { useState, useRef } from 'react';
import { showToast } from '../components/Toast';

export function useVoiceSearch({ onResult, triggerHaptic }) {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessingAudio, setIsProcessingAudio] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const processAudioWithGroq = async (audioBlob) => {
        const apiKey = import.meta.env.VITE_GROQ_API_KEY;
        const isDev = import.meta.env.DEV;

        // In production, use serverless proxy to protect API key
        // In dev, call Groq directly for speed
        if (!isDev && !apiKey) {
            // Production mode — use proxy
            try {
                const arrayBuffer = await audioBlob.arrayBuffer();
                const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

                const response = await fetch('/api/groq', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        endpoint: 'audio/transcriptions',
                        isFormData: true,
                        body: {
                            audioBase64: base64,
                            mimeType: 'audio/webm',
                            filename: 'audio.webm',
                            model: 'whisper-large-v3',
                            language: 'es',
                            prompt: 'Productos de bodega venezolana, víveres, harina pan, mavesa, chucherías, queso.',
                        },
                    }),
                });

                if (!response.ok) throw new Error(`Proxy Error: ${response.status}`);
                const data = await response.json();
                if (data.text) {
                    onResult(data.text.replace(/[.,!?]$/, '').trim());
                }
            } catch (error) {
                console.error('Error transcribing audio via proxy:', error);
                showToast('Error al procesar el audio. Inténtalo de nuevo.', 'error');
            } finally {
                setIsProcessingAudio(false);
            }
            return;
        }

        // Dev mode — direct API call
        if (!apiKey) {
            showToast('Falta la API Key de Groq en la configuración (.env)', 'error');
            setIsProcessingAudio(false);
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.webm');
            formData.append('model', 'whisper-large-v3');
            formData.append('language', 'es');
            formData.append('prompt', 'Productos de bodega venezolana, víveres, harina pan, mavesa, chucherías, queso.');

            const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}` },
                body: formData
            });

            if (!response.ok) throw new Error(`Groq API Error: ${response.status}`);

            const data = await response.json();
            if (data.text) {
                const cleanText = data.text.replace(/[.,!?]$/, '').trim();
                onResult(cleanText);
            }
        } catch (error) {
            console.error('Error transcribing audio:', error);
            showToast('Error al procesar el audio. Inténtalo de nuevo.', 'error');
        } finally {
            setIsProcessingAudio(false);
        }
    };

    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await processAudioWithGroq(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            triggerHaptic && triggerHaptic();
        } catch (error) {
            console.error('Error accessing microphone:', error);
            showToast('No se pudo acceder al micrófono. Verifica los permisos.', 'warning');
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsProcessingAudio(true);
            triggerHaptic && triggerHaptic();
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            handleStopRecording();
        } else {
            handleStartRecording();
        }
    };

    return { isRecording, isProcessingAudio, toggleRecording };
}
