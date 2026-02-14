"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Stethoscope,
  Clock,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { orpc } from "@/lib/orpc/client";
import { useT } from "@/lib/i18n/context";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
}

const emptyForm = {
  name: "",
  description: "",
  price: "",
  duration: "",
};

export default function ServicesPage() {
  const { orgId } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const t = useT();

  const fetchServices = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const data = await orpc.services.list({ orgId });
      setServices(data);
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditingId(service.id);
    setForm({
      name: service.name,
      description: service.description || "",
      price: (service.price / 100).toFixed(2),
      duration: String(service.duration),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!orgId || !form.name || !form.price || !form.duration) return;
    setSaving(true);
    try {
      const priceInCents = Math.round(Number.parseFloat(form.price) * 100);
      const duration = Number.parseInt(form.duration);

      if (editingId) {
        await orpc.services.update({
          orgId,
          id: editingId,
          name: form.name,
          description: form.description || null,
          price: priceInCents,
          duration,
        });
        toast.success(t.services.serviceUpdated);
      } else {
        await orpc.services.create({
          orgId,
          name: form.name,
          description: form.description || undefined,
          price: priceInCents,
          duration,
        });
        toast.success(t.services.serviceCreated);
      }
      setDialogOpen(false);
      fetchServices();
    } catch (error) {
      console.error("Error saving service:", error);
      toast.error(t.services.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!orgId) return;
    if (!confirm(t.services.deleteConfirm)) return;
    try {
      await orpc.services.delete({ orgId, id });
      toast.success(t.services.serviceDeleted);
      fetchServices();
    } catch (error) {
      console.error("Error deleting service:", error);
      toast.error(t.services.deleteFailed);
    }
  };

  const handleToggleActive = async (service: Service) => {
    if (!orgId) return;
    try {
      await orpc.services.update({
        orgId,
        id: service.id,
        isActive: service.isActive === 1 ? 0 : 1,
      });
      toast.success(
        service.isActive === 1 ? t.services.serviceDeactivated : t.services.serviceActivated,
      );
      fetchServices();
    } catch (error) {
      console.error("Error toggling service:", error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.services.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.services.subtitle}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t.services.addService}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : services.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Stethoscope className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t.services.noServices}</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              {t.services.noServicesHint}
            </p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t.services.addFirstService}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <Card
              key={service.id}
              className={
                service.isActive === 0 ? "opacity-60" : ""
              }
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate">
                      {service.name}
                    </h3>
                    {service.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {service.description}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={service.isActive === 1 ? "default" : "secondary"}
                    className="ml-2 cursor-pointer"
                    onClick={() => handleToggleActive(service)}
                  >
                    {service.isActive === 1 ? t.common.active : t.common.inactive}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1.5 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      ${(service.price / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{service.duration} {t.services.min}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(service)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {t.common.edit}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(service.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    {t.common.delete}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? t.services.editService : t.services.addService}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t.services.serviceName}</Label>
              <Input
                id="name"
                placeholder={t.services.serviceNamePlaceholder}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t.services.description}</Label>
              <Textarea
                id="description"
                placeholder={t.services.descriptionPlaceholder}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">{t.services.price}</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="150.00"
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">{t.services.duration}</Label>
                <Input
                  id="duration"
                  type="number"
                  min="5"
                  step="5"
                  placeholder="30"
                  value={form.duration}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, duration: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name || !form.price || !form.duration}
              className="w-full"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? t.services.updateService : t.services.createService}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
