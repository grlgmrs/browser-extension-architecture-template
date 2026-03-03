import { Link } from '@tanstack/react-router';

export const Home = () => {
  return (
    <div>
      <h1>Home</h1>
      <br />
      <Link to="/login">Login</Link>
    </div>
  );
};
