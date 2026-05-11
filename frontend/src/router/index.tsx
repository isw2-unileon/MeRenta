import { createBrowserRouter, Navigate } from "react-router-dom";

import { PublicLayout } from "@/layouts/PublicLayout.tsx";
import { AppLayout } from "@/layouts/AppLayout.tsx";
import { MinimalLayout } from "@/layouts/MinimalLayout.tsx";
import { BlankLayout } from "@/layouts/BlankLayout.tsx";
import { ProtectedRoute } from "@/router/ProtectedRoute.tsx";
import { RootProvider } from "@/router/ProvideRouter.tsx";

import { Auth } from "@/pages/Auth.tsx";
import { Landing } from "@/pages/Landing.tsx";
import { Home } from "@/pages/Home.tsx";
import { Search } from "@/pages/Search.tsx";
import { Product } from "@/pages/Product.tsx";
import { ProductCreate } from "@/pages/ProductCreate.tsx";
import { ProductEdit } from "@/pages/ProductEdit.tsx";
import { ProfileEdit } from "@/pages/ProfileEdit.tsx";
import { MyProfile } from "@/pages/MyProfile.tsx";
import { ProfileOther } from "@/pages/ProfileOther.tsx";
import { Favs } from "@/pages/Favs.tsx";
import { Chat } from "@/pages/Chat.tsx";
import { Checkout } from "@/pages/Checkout.tsx";
import { PaymentSuccess } from "@/pages/PaymentSuccess.tsx";
import { PaymentError } from "@/pages/PaymentError.tsx";
import { Terms } from "@/pages/Terms.tsx";
import { Privacy } from "@/pages/Privacy.tsx";
import { Info } from "@/pages/Info.tsx";
import { NotFound } from "@/pages/NotFound.tsx";
import { Forbidden } from "@/pages/Forbidden.tsx";
import { ServerError } from "@/pages/ServerError.tsx";
import { Error } from "@/pages/Error.tsx";
import { ProfilePublic } from "@/pages/ProfilePublic.tsx";

const router = createBrowserRouter([
  {
    element: <RootProvider />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: <Landing /> },
          { path: "terms", element: <Terms /> },
          { path: "privacy", element: <Privacy /> },
          { path: "more-info", element: <Info /> },
          { path: "profile/public", element: <ProfilePublic /> },
        ],
      },

      {
        element: <BlankLayout />,
        children: [
          { path: "auth", element: <Auth /> },
          { path: "error", element: <Error /> },
          { path: "payment/success", element: <PaymentSuccess /> },
          { path: "payment/error", element: <PaymentError /> },
          { path: "not-found", element: <NotFound /> },
        ],
      },

      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <MinimalLayout />,
            children: [
              { path: "chat", element: <Chat /> },
              { path: "chat/:conversationId", element: <Chat /> },
            ],
          },

          {
            element: <AppLayout />,
            children: [
              { path: "home", element: <Home /> },
              { path: "search", element: <Search /> },
              { path: "product/new", element: <ProductCreate /> },
              { path: "product/:id/edit", element: <ProductEdit /> },
              { path: "product/:id", element: <Product /> },
              { path: "profile", element: <MyProfile /> },
              { path: "profile/edit", element: <ProfileEdit /> },
              { path: "profile/:id", element: <ProfileOther /> },
              { path: "favs", element: <Favs /> },
              { path: "checkout/:id", element: <Checkout /> },
              { path: "403", element: <Forbidden /> },
              { path: "500", element: <ServerError /> },
            ],
          },
        ],
      },

      {
        path: "*",
        element: (
          <Navigate
            to="/not-found"
            replace
          />
        ),
      },
    ],
  },
]);

export { router };
