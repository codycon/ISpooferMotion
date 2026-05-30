import { motion } from 'framer-motion';
import { AlertCircle, ChevronDown, Globe, Info, Search, Shield, User } from 'lucide-react';
import { useState } from 'react';
import { Accordion, AccordionItem, Button } from '../../../ism-library';

// Mock components to showcase theme tokens and styling
export default function ThemePreviewBoard() {
  const [isToggled, setIsToggled] = useState(true);
  const [inputValue, setInputValue] = useState('');

  return (
    <div className="w-full h-full p-8 overflow-y-auto bg-bg-base text-text-primary rounded-[var(--radius-lg)] border border-border-subtle shadow-inner flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">Theme Preview Sandbox</h2>
        <p className="text-text-muted text-sm">
          Live components demonstrating the active theme configuration.
        </p>
      </div>

      {/* Buttons Section */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary border-b border-border-subtle pb-2">
          Buttons & Actions
        </h3>
        <div className="flex flex-wrap gap-4 items-center">
          <Button label="Primary Button" className="bg-primary text-white font-medium" />
          <Button label="Secondary (Elevated)" className="bg-bg-elevated hover:bg-border-subtle" />
          <Button
            label="Outline"
            className="border border-border-strong bg-transparent hover:bg-bg-elevated"
          />
          <Button
            label="Ghost"
            className="bg-transparent hover:bg-bg-elevated text-text-secondary"
          />
          <Button label="Danger" className="bg-danger/20 text-danger border border-danger/50" />
        </div>
      </section>

      {/* Inputs & Controls */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary border-b border-border-subtle pb-2">
          Inputs & Controls
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-text-secondary">Text FormInput</label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                size={16}
              />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Search resources..."
                className="w-full h-10 pl-10 pr-4 bg-bg-surface border border-border-strong rounded-[var(--radius-md)] text-sm text-text-primary outline-none focus:border-primary transition-colors placeholder:text-text-muted"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-text-secondary">FormDropdown Select</label>
            <div className="relative cursor-pointer h-10 bg-bg-surface border border-border-strong rounded-[var(--radius-md)] flex items-center justify-between px-4 hover:border-text-secondary transition-colors">
              <span className="text-sm">Default Option</span>
              <ChevronDown size={16} className="text-text-muted" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-bg-surface border border-border-subtle rounded-[var(--radius-lg)]">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Auto Updates</span>
              <span className="text-xs text-text-muted">
                Keep application up to date automatically
              </span>
            </div>
            <button
              onClick={() => setIsToggled(!isToggled)}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                isToggled ? 'bg-primary' : 'bg-border-strong'
              }`}
            >
              <motion.div
                layout
                className="w-4 h-4 bg-white rounded-full shadow-sm"
                animate={{ x: isToggled ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Complex Surfaces (Accordion / Cards) */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary border-b border-border-subtle pb-2">
          Surfaces & Layouts
        </h3>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <Accordion defaultExpandedKeys={['preview']}>
              <AccordionItem
                value="preview"
                title={
                  <span className="flex items-center gap-3 font-semibold">
                    <Globe size={18} className="text-primary" /> Network Settings
                  </span>
                }
              >
                <div className="p-4 flex flex-col gap-4 text-sm text-text-secondary bg-bg-surface border-t border-border-subtle">
                  <p>This is content rendered inside an elevated accordion panel.</p>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-success/10 text-success rounded-md text-xs font-bold border border-success/20">
                      CONNECTED
                    </span>
                    <span className="px-2 py-1 bg-warning/10 text-warning rounded-md text-xs font-bold border border-warning/20">
                      RATE LIMITED
                    </span>
                  </div>
                </div>
              </AccordionItem>
              <AccordionItem
                value="security"
                title={
                  <span className="flex items-center gap-3 font-semibold">
                    <Shield size={18} className="text-text-muted" /> Security
                  </span>
                }
              >
                <div className="p-4 bg-bg-surface border-t border-border-subtle" />
              </AccordionItem>
            </Accordion>
          </div>

          <div className="flex-1 bg-bg-elevated border border-border-subtle rounded-[var(--radius-lg)] p-5 shadow-floating flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
              <div className="w-10 h-10 rounded-full bg-bg-surface flex items-center justify-center border border-border-strong text-primary">
                <User size={20} />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm">Account Overview</span>
                <span className="text-xs text-text-muted">Manage your profile</span>
              </div>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              Floating cards utilize{' '}
              <span className="font-mono text-xs bg-bg-surface px-1 py-0.5 rounded text-primary">
                var(--bg-elevated)
              </span>{' '}
              for high visual hierarchy against the base background.
            </p>
          </div>
        </div>
      </section>

      {/* Alerts & Notifications */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary border-b border-border-subtle pb-2">
          Alerts & Feedback
        </h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/30 rounded-[var(--radius-md)] text-sm">
            <Info size={18} className="text-primary mt-0.5" />
            <div className="flex flex-col">
              <span className="font-semibold text-text-primary">Theme Updated</span>
              <span className="text-text-secondary">
                Your changes have been successfully applied globally.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-danger/10 border border-danger/30 rounded-[var(--radius-md)] text-sm">
            <AlertCircle size={18} className="text-danger mt-0.5" />
            <div className="flex flex-col">
              <span className="font-semibold text-text-primary">Connection Lost</span>
              <span className="text-text-secondary">
                Unable to reach the authentication server.
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
