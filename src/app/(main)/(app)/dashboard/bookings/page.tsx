"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Loader2,
  Plus,
  CalendarDays,
  Clock,
  Phone,
  User,
  MessageSquare,
  Mic,
  Mail,
  MonitorSmartphone,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/lib/orpc/client";
import { useT } from "@/lib/i18n/context";
import { t as fmt } from "@/lib/i18n/utils";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface Booking {
  id: string;
  patientName: string;
  patientPhone: string | null;
  patientEmail: string | null;
  date: string;
  time: string;
  status: string;
  notes: string | null;
  source: string;
  service: Service | null;
  createdAt: Date;
}

const SOURCE_ICONS: Record<string, typeof MessageSquare> = {
  chat: MessageSquare,
  elevenlabs: Mic,
  telegram: MessageSquare,
  email: Mail,
  dashboard: MonitorSmartphone,
};

const emptyForm = {
  patientName: "",
  patientPhone: "",
  patientEmail: "",
  serviceId: "",
  date: "",
  time: "",
  notes: "",
};

export default function BookingsPage() {
  const { orgId } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const t = useT();

  const STATUS_CONFIG: Record<
    string,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    confirmed: { label: t.bookings.confirmed, variant: "default" },
    completed: { label: t.bookings.completed, variant: "secondary" },
    cancelled: { label: t.bookings.cancelled, variant: "destructive" },
    no_show: { label: t.bookings.noShow, variant: "outline" },
  };

  const fetchBookings = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const data = await orpc.bookings.list({
        orgId,
        status:
          statusFilter !== "all"
            ? (statusFilter as "confirmed" | "cancelled" | "completed" | "no_show")
            : undefined,
        pageSize: 50,
      });
      setBookings(data.bookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, statusFilter]);

  const fetchServices = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await orpc.services.list({ orgId });
      setServices(data);
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  }, [orgId]);

  useEffect(() => {
    fetchBookings();
    fetchServices();
  }, [fetchBookings, fetchServices]);

  const handleCreate = async () => {
    if (!orgId || !form.patientName || !form.date || !form.time) return;
    setSaving(true);
    try {
      await orpc.bookings.create({
        orgId,
        patientName: form.patientName,
        patientPhone: form.patientPhone || undefined,
        patientEmail: form.patientEmail || undefined,
        serviceId: form.serviceId || undefined,
        date: form.date,
        time: form.time,
        notes: form.notes || undefined,
        source: "dashboard",
      });
      toast.success(t.bookings.bookingCreated);
      setDialogOpen(false);
      setForm(emptyForm);
      fetchBookings();
    } catch (error) {
      console.error("Error creating booking:", error);
      toast.error(t.bookings.createFailed);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    if (!orgId) return;
    try {
      await orpc.bookings.update({
        orgId,
        id,
        status: status as "confirmed" | "cancelled" | "completed" | "no_show",
      });
      toast.success(fmt(t.bookings.bookingStatus, { status }));
      fetchBookings();
    } catch (error) {
      console.error("Error updating booking:", error);
      toast.error(t.bookings.updateFailed);
    }
  };

  const SourceIcon = (source: string) => {
    const Icon = SOURCE_ICONS[source] || MonitorSmartphone;
    return <Icon className="h-3.5 w-3.5" />;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.bookings.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.bookings.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.bookings.allStatuses}</SelectItem>
              <SelectItem value="confirmed">{t.bookings.confirmed}</SelectItem>
              <SelectItem value="completed">{t.bookings.completed}</SelectItem>
              <SelectItem value="cancelled">{t.bookings.cancelled}</SelectItem>
              <SelectItem value="no_show">{t.bookings.noShow}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              setForm(emptyForm);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t.bookings.addBooking}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t.bookings.noBookings}</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              {statusFilter !== "all"
                ? fmt(t.bookings.noStatusBookings, { status: statusFilter })
                : t.bookings.noBookingsYet}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {bookings.map((booking) => {
            const statusConf =
              STATUS_CONFIG[booking.status] || STATUS_CONFIG.confirmed;
            return (
              <Card key={booking.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {booking.patientName}
                        </h3>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                          {booking.patientPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {booking.patientPhone}
                            </span>
                          )}
                          {booking.patientEmail && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {booking.patientEmail}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge variant={statusConf.variant}>
                      {statusConf.label}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm mb-3">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{booking.date}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{booking.time}</span>
                    </div>
                    {booking.service && (
                      <Badge variant="outline">{booking.service.name}</Badge>
                    )}
                    <span
                      className="flex items-center gap-1 text-xs text-muted-foreground"
                      title={fmt(t.bookings.source, { source: booking.source })}
                    >
                      {SourceIcon(booking.source)}
                      {booking.source}
                    </span>
                  </div>

                  {booking.notes && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {booking.notes}
                    </p>
                  )}

                  {booking.status === "confirmed" && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatus(booking.id, "completed")}
                      >
                        {t.bookings.complete}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatus(booking.id, "cancelled")}
                        className="text-destructive hover:text-destructive"
                      >
                        {t.bookings.cancel}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatus(booking.id, "no_show")}
                      >
                        {t.bookings.noShow}
                      </Button>
                    </div>
                  )}
                  {booking.status === "cancelled" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatus(booking.id, "confirmed")}
                    >
                      {t.bookings.reconfirm}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.bookings.newBooking}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="patientName">{t.bookings.patientName}</Label>
              <Input
                id="patientName"
                placeholder={t.bookings.patientNamePlaceholder}
                value={form.patientName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, patientName: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="patientPhone">{t.bookings.phone}</Label>
                <Input
                  id="patientPhone"
                  placeholder={t.bookings.phonePlaceholder}
                  value={form.patientPhone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, patientPhone: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientEmail">{t.bookings.email}</Label>
                <Input
                  id="patientEmail"
                  type="email"
                  placeholder={t.bookings.emailPlaceholder}
                  value={form.patientEmail}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, patientEmail: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service">{t.bookings.service}</Label>
              <Select
                value={form.serviceId}
                onValueChange={(v) => setForm((f) => ({ ...f, serviceId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.bookings.selectService} />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} - ${(s.price / 100).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">{t.bookings.date}</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">{t.bookings.time}</Label>
                <Input
                  id="time"
                  type="time"
                  value={form.time}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, time: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{t.bookings.notes}</Label>
              <Textarea
                id="notes"
                placeholder={t.bookings.notesPlaceholder}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={2}
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={
                saving || !form.patientName || !form.date || !form.time
              }
              className="w-full"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t.bookings.createBooking}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
