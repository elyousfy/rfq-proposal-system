import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle, FileText, Settings, Eye, Wand2, Download } from 'lucide-react';

export interface WizardStep {
  id: string;
  title: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  isComplete: boolean;
  canProceed: boolean;
}

interface ProposalWizardProps {
  steps: WizardStep[];
  currentStepIndex: number;
  onStepChange: (index: number) => void;
  onComplete?: () => void;
}

export default function ProposalWizard({
  steps,
  currentStepIndex,
  onStepChange,
  onComplete
}: ProposalWizardProps) {
  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const canGoNext = currentStep?.canProceed || false;
  const canGoPrev = currentStepIndex > 0;

  const goNext = () => {
    if (canGoNext) {
      if (isLastStep && onComplete) {
        onComplete();
      } else {
        onStepChange(currentStepIndex + 1);
      }
    }
  };

  const goPrev = () => {
    if (canGoPrev) {
      onStepChange(currentStepIndex - 1);
    }
  };

  const goToStep = (index: number) => {
    if (index <= currentStepIndex || steps[index - 1]?.isComplete) {
      onStepChange(index);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Progress Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Proposal Generation Wizard
            </h1>
            <div className="flex items-center gap-4">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => goToStep(index)}
                  disabled={index > currentStepIndex && !steps[index - 1]?.isComplete}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
                    index === currentStepIndex
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : index < currentStepIndex || step.isComplete
                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {step.isComplete ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    step.icon
                  )}
                  <span className="text-sm font-medium">{step.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Progress indicator */}
          <div className="mt-4 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <motion.div
              className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{
                width: `${((currentStepIndex + (canGoNext ? 1 : 0)) / steps.length) * 100}%`
              }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="min-h-[600px]"
          >
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                {currentStep?.icon}
                <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {currentStep?.title}
                </h2>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              {currentStep?.component}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <button
            onClick={goPrev}
            disabled={!canGoPrev}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              canGoPrev
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          <div className="text-sm text-slate-500 dark:text-slate-400">
            Step {currentStepIndex + 1} of {steps.length}
          </div>

          <button
            onClick={goNext}
            disabled={!canGoNext}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              canGoNext
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
            }`}
          >
            {isLastStep ? 'Complete' : 'Next'}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function getWizardStepIcons() {
  return {
    rfq: <FileText className="w-5 h-5" />,
    template: <Settings className="w-5 h-5" />,
    toc: <Eye className="w-5 h-5" />,
    generate: <Wand2 className="w-5 h-5" />,
    review: <Download className="w-5 h-5" />
  };
}