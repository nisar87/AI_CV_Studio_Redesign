'use client';

import { createContext, useContext } from 'react';
import type { ResumeDocument } from '@/modules/resume/schema';

/** The document being edited, for AI actions that need wider context (role, skills…). */
const DocContext = createContext<ResumeDocument | null>(null);
export const AiDocProvider = DocContext.Provider;
export const useAiDoc = () => useContext(DocContext);
