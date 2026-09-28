import { CheckIcon, XIcon } from "lucide-react";
import { useContactStore } from "../store/useContactStore";

function ContactRequests() {
  const {
    incomingRequests,
    outgoingRequests,
    acceptContactRequest,
    rejectContactRequest,
    cancelContactRequest,
  } = useContactStore();

  if (incomingRequests.length === 0 && outgoingRequests.length === 0)
    return null;

  return (
    <div className="space-y-2">
      {incomingRequests.length > 0 && (
        <>
          <h5 className="sidebar-heading">
            Requests ({incomingRequests.length})
          </h5>

          {incomingRequests.map((request) => (
            <div
              key={request._id}
              className="bg-brand/10 p-3 rounded-lg flex items-center gap-3"
            >
              <img
                src={request.user.profilePic || "/avatar.png"}
                alt={request.user.fullName}
                className="size-9 rounded-full object-cover"
              />

              <div className="min-w-0 flex-1">
                <h4 className="text-slate-200 text-sm font-medium truncate">
                  {request.user.fullName}
                </h4>
                <p className="text-slate-500 text-xs truncate">
                  @{request.user.username}
                </p>
              </div>

              <button
                type="button"
                onClick={() => acceptContactRequest(request._id)}
                title="Accept"
                className="size-7 rounded-full bg-brand/20 text-brand-soft hover:bg-brand/30 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
              >
                <CheckIcon className="size-4" />
              </button>

              <button
                type="button"
                onClick={() => rejectContactRequest(request._id)}
                title="Reject"
                className="size-7 rounded-full bg-surface-4 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          ))}
        </>
      )}

      {outgoingRequests.length > 0 && (
        <>
          <h5 className="sidebar-heading pt-2">
            Sent ({outgoingRequests.length})
          </h5>

          {outgoingRequests.map((request) => (
            <div
              key={request._id}
              className="bg-surface-3 p-3 rounded-lg flex items-center gap-3"
            >
              <img
                src={request.user.profilePic || "/avatar.png"}
                alt={request.user.fullName}
                className="size-9 rounded-full object-cover opacity-60"
              />

              <div className="min-w-0 flex-1">
                <h4 className="text-slate-300 text-sm truncate">
                  {request.user.fullName}
                </h4>
                <p className="text-slate-500 text-xs truncate">
                  @{request.user.username} · pending
                </p>
              </div>

              <button
                type="button"
                onClick={() => cancelContactRequest(request._id)}
                title="Cancel request"
                className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
export default ContactRequests;
