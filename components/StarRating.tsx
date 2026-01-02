
import React from 'react';

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}

const StarRating: React.FC<StarRatingProps> = ({ value, onChange, label }) => {
  return (
    <div className="flex flex-col">
      {label && <span className="text-xs text-slate-500 mb-1">{label}</span>}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onChange(star === value ? 0 : star)}
            className={`text-lg transition-colors ${
              star <= value ? 'text-yellow-400' : 'text-slate-200'
            }`}
          >
            <i className={`fa-star ${star <= value ? 'fas' : 'far'}`}></i>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StarRating;
