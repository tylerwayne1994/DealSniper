import React from 'react';
import { CheckCircle, Circle } from 'lucide-react';

/**
 * WizardStepNavigation - Cactus-style breadcrumb navigation
 * Shows step progress with checkmarks for completed steps
 */
export default function WizardStepNavigation({ 
  steps = [], 
  activeStep, 
  completedSteps = [],
  onStepClick 
}) {
  
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: '16px 20px',
      marginBottom: 24,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap'
    }}>
      {steps.map((step, idx) => {
        const isActive = activeStep === step.id;
        const isCompleted = completedSteps.includes(step.id);
        const isClickable = !!onStepClick;
        const Icon = step.icon;
        
        return (
          <React.Fragment key={step.id}>
            {idx > 0 && (
              <div style={{
                width: 24,
                height: 2,
                background: isCompleted ? '#10b981' : '#e5e7eb',
                borderRadius: 1
              }} />
            )}
            
            <div
              onClick={() => isClickable && onStepClick(step.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                borderRadius: 10,
                background: isActive ? '#eff6ff' : 
                           isCompleted ? '#dcfce7' : '#f9fafb',
                border: `2px solid ${isActive ? '#3b82f6' : 
                                     isCompleted ? '#10b981' : '#e5e7eb'}`,
                cursor: isClickable ? 'pointer' : 'default',
                transition: 'all 0.2s',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (isClickable) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (isClickable) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {/* Step icon/indicator */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: isActive ? '#3b82f6' :
                           isCompleted ? '#10b981' : '#e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                transition: 'all 0.2s'
              }}>
                {isCompleted ? (
                  <CheckCircle size={18} />
                ) : Icon ? (
                  <Icon size={18} />
                ) : (
                  <Circle size={18} />
                )}
              </div>
              
              {/* Step label */}
              <div>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: isActive ? '#1d4ed8' :
                         isCompleted ? '#059669' : '#6b7280'
                }}>
                  {step.label}
                </div>
                {step.subtitle && (
                  <div style={{
                    fontSize: 11,
                    color: '#9ca3af',
                    marginTop: 2
                  }}>
                    {step.subtitle}
                  </div>
                )}
              </div>
              
              {/* Active indicator */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  bottom: -2,
                  left: 16,
                  right: 16,
                  height: 3,
                  background: '#3b82f6',
                  borderRadius: '3px 3px 0 0'
                }} />
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
