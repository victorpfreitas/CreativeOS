import { ArrowLeft, Save, Sparkles, Image as ImageIcon, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NewAutomation() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="flex items-center gap-4">
        <Link to="/automations" className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create Automation</h1>
          <p className="text-slate-500 text-sm">Design a repeatable content system for a specific niche.</p>
        </div>
      </header>

      <form className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            Core Strategy
          </h2>
          <p className="text-sm text-slate-500 mb-4">Define what this automation is about and how the AI should write the content.</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Automation Name</label>
              <input type="text" placeholder="e.g. Real Estate Tips" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Niche / Topic</label>
              <input type="text" placeholder="e.g. First-time homebuyers" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Narrative Prompt</label>
            <textarea rows={3} placeholder="Describe the tone and angle. e.g. Informative but casual, focusing on common mistakes." className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Format Prompt</label>
            <textarea rows={2} placeholder="e.g. 5 slides max. Short bullet points. Use emojis." className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
          </div>
        </div>

        {/* Image Content */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-indigo-500" />
            Visual Identity
          </h2>
          <p className="text-sm text-slate-500 mb-4">Choose the image collections to pull backgrounds from.</p>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 cursor-pointer transition-colors">
              <p className="text-sm font-medium text-slate-700">Hook Cover Collection</p>
              <p className="text-xs text-slate-500 mt-1">Select Pinterest Board</p>
            </div>
            <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 cursor-pointer transition-colors">
              <p className="text-sm font-medium text-slate-700">Body Slides Collection</p>
              <p className="text-xs text-slate-500 mt-1">Select Pinterest Board</p>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500" />
            Schedule & Publishing
          </h2>
          <p className="text-sm text-slate-500 mb-4">When should we generate drafts and how should they be published?</p>

          <div className="flex gap-4">
            <select className="px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option>Every Day</option>
              <option>Weekdays</option>
              <option>Custom</option>
            </select>
            <input type="time" defaultValue="10:00" className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div className="flex justify-end pt-4 pb-12">
          <button type="button" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors">
            <Save className="w-4 h-4" />
            Save & Generate Initial Hooks
          </button>
        </div>
      </form>
    </div>
  );
}
