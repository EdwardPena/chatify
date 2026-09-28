import { useEffect } from "react";
import { UserXIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useContactStore } from "../store/useContactStore";
import { useAuthStore } from "../store/useAuthStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import AddContact from "./AddContact";
import ContactRequests from "./ContactRequests";

function ContactList({ query = "" }) {
  const { selectedUser, setSelectedUser } = useChatStore();
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

  // the sidebar search filters what is already loaded, no round trip needed
  const term = query.trim().toLowerCase();
  const visibleContacts = term
    ? contacts.filter(
        (contact) =>
          contact.fullName.toLowerCase().includes(term) ||
          contact.username.toLowerCase().includes(term),
      )
    : contacts;

  return (
    <div className="space-y-3">
      <AddContact />
      <ContactRequests />

      {isContactsLoading ? (
        <UsersLoadingSkeleton />
      ) : contacts.length === 0 ? (
        <p className="text-slate-500 text-xs text-center px-4 py-6">
          No contacts yet. Search for someone by their username to send them a
          contact request.
        </p>
      ) : (
        <div>
          <h5 className="sidebar-heading mb-1">Contacts</h5>

          {visibleContacts.map((contact) => {
            const isOnline = onlineUsers?.includes(contact._id);

            return (
              <div
                key={contact._id}
                className={`sidebar-item group ${
                  selectedUser?._id === contact._id ? "sidebar-item-active" : ""
                }`}
                onClick={() => setSelectedUser(contact)}
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={contact.profilePic || "/avatar.png"}
                    alt={contact.fullName}
                    className="size-6 rounded-full object-cover"
                  />
                  {isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-green-500 border-2 border-surface-1" />
                  )}
                </div>

                <span className="truncate flex-1">{contact.fullName}</span>

                <button
                  type="button"
                  onClick={(e) => handleRemove(e, contact)}
                  title="Remove contact"
                  className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer flex-shrink-0"
                >
                  <UserXIcon className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default ContactList;
