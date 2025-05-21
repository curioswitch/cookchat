import { clientOnly } from "vike-react/clientOnly";

const Chat = clientOnly(() => import("./Chat.jsx"));

export default function Page() {
  return <Chat />;
}
