import {redirect} from "next/navigation";

// Windows application only: the public website lives in JOYKIX/pokestream (private).
export default function Home(){redirect("/users");}
