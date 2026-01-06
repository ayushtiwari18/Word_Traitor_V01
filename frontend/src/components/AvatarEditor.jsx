import React, { useState, useEffect } from "react";
import Avatar, { genConfig } from "react-nice-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RefreshCw, Save } from "lucide-react";

const AvatarEditor = ({ isOpen, onClose, initialConfig, onSave, initialName }) => {
  const [config, setConfig] = useState(initialConfig || genConfig());
  const [name, setName] = useState(initialName || "");

  useEffect(() => {
    if (initialConfig) setConfig(initialConfig);
    if (initialName) setName(initialName);
  }, [initialConfig, initialName, isOpen]);

  const updateConfig = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleRandomize = () => {
    setConfig(genConfig());
  };

  const handleSave = () => {
    onSave(config, name);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-center font-heading text-xl">Customize Your Look</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {/* Avatar Preview */}
          <div className="relative group">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary shadow-xl">
              <Avatar style={{ width: "100%", height: "100%" }} {...config} />
            </div>
            <Button
              variant="secondary"
              size="icon"
              className="absolute bottom-0 right-0 rounded-full shadow-md"
              onClick={handleRandomize}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Name Edit */}
          <div className="w-full space-y-2">
            <Label>Display Name</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              maxLength={15}
              className="text-center font-bold text-lg"
            />
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="space-y-2">
              <Label>Hair Style</Label>
              <Select value={config.hairStyle} onValueChange={(v) => updateConfig("hairStyle", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="thick">Thick</SelectItem>
                  <SelectItem value="mohawk">Mohawk</SelectItem>
                  <SelectItem value="womanLong">Long</SelectItem>
                  <SelectItem value="womanShort">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Hat Style</Label>
               <Select value={config.hatStyle} onValueChange={(v) => updateConfig("hatStyle", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="beanie">Beanie</SelectItem>
                  <SelectItem value="turban">Turban</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Glasses</Label>
              <Select value={config.glassesStyle} onValueChange={(v) => updateConfig("glassesStyle", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="round">Round</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                </SelectContent>
              </Select>
            </div>

             <div className="space-y-2">
              <Label>Shirt Color</Label>
              <Select value={config.shirtColor} onValueChange={(v) => updateConfig("shirtColor", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="#9287FF">Purple</SelectItem>
                  <SelectItem value="#6BD9E9">Cyan</SelectItem>
                  <SelectItem value="#FC909F">Pink</SelectItem>
                  <SelectItem value="#F4D150">Yellow</SelectItem>
                  <SelectItem value="#77311D">Brown</SelectItem>
                </SelectContent>
              </Select>
            </div>
             
             {/* Can add more detailed controls if needed */}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} className="w-full gap-2" variant="neonCyan">
            <Save className="w-4 h-4" /> Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AvatarEditor;
