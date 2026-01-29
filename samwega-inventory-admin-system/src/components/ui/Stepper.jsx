import { Check } from "lucide-react";

export default function Stepper({ steps, currentStep }) {
  return (
    <div className="w-full py-4">
      <div className="relative flex items-center justify-between w-full">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10 rounded-full" />
        <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-sky-600 -z-10 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div key={index} className="flex flex-col items-center gap-2 bg-slate-50 px-2">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  isCompleted
                    ? "border-sky-600 bg-sky-600 text-white"
                    : isCurrent
                    ? "border-sky-600 bg-white text-sky-600"
                    : "border-slate-300 bg-white text-slate-400"
                }`}
              >
                {isCompleted ? (
                  <Check size={20} />
                ) : (
                  <span className="text-sm font-bold">{index + 1}</span>
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors duration-300 ${
                  isCurrent || isCompleted ? "text-slate-900" : "text-slate-500"
                }`}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
