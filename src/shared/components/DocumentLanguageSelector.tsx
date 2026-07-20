import { Check } from "lucide-react";
import { useState } from "react";

const languages = ["Espanol", "English - United States"];

export function DocumentLanguageSelector() {
  const [selected, setSelected] = useState(languages[0]);

  return (
    <div className="card">
      <div className="card-title-row">
        <div>
          <h2 className="card-title">Idioma del documento</h2>
          <p className="activity-meta">
            Componente visual reutilizable para cotizaciones, facturas, ordenes de cambio e informes.
          </p>
        </div>
      </div>
      <div className="language-selector">
        {languages.map((language) => (
          <button
            className={`language-option ${selected === language ? "active" : ""}`}
            key={language}
            type="button"
            onClick={() => setSelected(language)}
          >
            {language}
            {selected === language ? <Check size={18} /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
