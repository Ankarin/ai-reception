import * as analytics from "./procedures/analytics";
import * as bookings from "./procedures/bookings";
import * as chats from "./procedures/chats";
import * as organizations from "./procedures/organizations";
import * as services from "./procedures/services";
import * as uploads from "./procedures/uploads";

export const router = {
  organizations: {
    list: organizations.getOrganizations,
    get: organizations.getOrganization,
    update: organizations.updateOrganization,
    create: organizations.createOrganization,
  },
  chats: {
    list: chats.getChats,
    create: chats.createChat,
    updateContact: chats.updateChatContact,
  },
  analytics: {
    get: analytics.getAnalytics,
  },
  uploads: {
    upload: uploads.uploadFile,
    delete: uploads.deleteFile,
  },
  services: {
    list: services.getServices,
    create: services.createService,
    update: services.updateService,
    delete: services.deleteService,
  },
  bookings: {
    list: bookings.getBookings,
    create: bookings.createBooking,
    update: bookings.updateBooking,
  },
};

export type AppRouter = typeof router;
