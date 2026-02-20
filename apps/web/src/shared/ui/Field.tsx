import React from 'react';

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

export const Field: React.FC<FieldProps> = ({ label, children }) => {
  return (
    <label className="grid" style={{ gap: 6 }}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
};
