import { useEffect } from "react";
import { UserXIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useContactStore } from "../store/useContactStore";
import { useAuthStore } from "../store/useAuthStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import AddContact from "./AddContact";
import ContactRequests from "./ContactRequests";

function ContactList() {
  const { setSelectedUser } = useChatStore();
  const {
    getMyContacts,
    getContactRequests,
    contacts,
    isContactsLoading,
    removeContact,
  } = useContactStore();
  const { onlineUsers } = useAuthStore();

  useEffect(() => {
    getMyContacts();
    getContactRequests();
  }, [getMyContacts, getContactRequests]);

  const handleRemove = (e, contact) => {
    // don't open the chat we are about to remove
    e.stopPropagation();

    const confirmed = window.confirm(
      `Remove ${contact.fullName} from your contacts? You will both lose each other as contacts.`,
    );
    if (confirmed) removeContact(contact._id);
  };

  return (
    <div className="space-y-3">
      <AddContact />
      <ContactRequests />

      {isContactsLoading ? (
        <UsersLoadingSkeleton />
      ) : contacts.length === 0 ? (
        <p className="text-slate-400 text-sm text-center px-4 py-6">
          No contacts yet. Search for someone by their username to send them a
          contact request.
        </p>
      ) : (
        contacts.map((contact) => {
          const isOnline = onlineUsers?.includes(contact._id);

          return (
            <div
              key={contact._id}
              className="bg-cyan-500/10 p-4 rounded-lg cursor-pointer hover:bg-cyan-500/20 transition-colors group"
              onClick={() => setSelectedUser(contact)}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="size-12 rounded-full">
                    <img
                      src={contact.profilePic || "/avatar.png"}
                      alt={contact.fullName}
                      className="size-full rounded-full object-cover"
                    />
                  </div>
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 size-3 rounded-full bg-green-500 border-2 border-slate-800" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-slate-200 font-medium truncate">
                    {contact.fullName}
                  </h4>
                  <p className="text-slate-400 text-xs truncate">
                    @{contact.username}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleRemove(e, contact)}
                  title="Remove contact"
                  className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer flex-shrink-0"
                >
                  <UserXIcon className="size-5" />
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
export default ContactList;
